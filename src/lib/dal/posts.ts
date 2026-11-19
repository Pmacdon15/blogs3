import "server-only";
import { put } from "@vercel/blob";
import {
  dbCreatePost,
  dbDeletePost,
  dbFindPostIdBySlug,
  dbGetPostById,
  dbListAllPosts,
  dbSetPostStatus,
  dbUpdatePost,
} from "@/db/posts";
import type { PostChange } from "@/lib/cache/tags";
import { assertAdmin, NotAuthorizedError } from "@/lib/dal/auth";
import {
  IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  postIdSchema,
  postInputSchema,
  postPatchSchema,
} from "@/lib/schemas";
import type { Post, PostStatus, PostSummary, Result } from "@/lib/types";

/*
 * The data access layer for editing. Every function takes the caller's user
 * id (from the Clerk session in actions/pages, or from the verified OAuth
 * token in the MCP server), checks the admin, validates input with zod, then
 * calls the db. Mutations return the PostChange the caller hands to
 * updatePostCaches (actions) or revalidatePostCaches (route handlers).
 */

export type Mutation = Result<{ post: Post; change: PostChange }>;

function fail(error: unknown): { ok: false; error: string } {
  if (error instanceof NotAuthorizedError)
    return { ok: false, error: error.message };
  console.error("DAL: unexpected error", error);
  return { ok: false, error: "Something went wrong. Please try again." };
}

function invalid(issues: { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join(".") || "_";
    fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
  }
  return {
    ok: false as const,
    error: issues[0]?.message ?? "Invalid input",
    fieldErrors,
  };
}

const notFound = { ok: false as const, error: "Post not found." };
const slugTaken = {
  ok: false as const,
  error: "Another post already uses that slug.",
  fieldErrors: { slug: ["Another post already uses that slug."] },
};

// ---------------------------------------------------------------------- reads

export async function listPostsForAdmin(
  userId: string | null | undefined,
): Promise<Result<PostSummary[]>> {
  try {
    await assertAdmin(userId);
    return { ok: true, data: await dbListAllPosts() };
  } catch (error) {
    return fail(error);
  }
}

/** Any post (drafts too) for the editor. */
export async function getPostForEdit(
  userId: string | null | undefined,
  id: unknown,
): Promise<Result<Post>> {
  try {
    await assertAdmin(userId);
    const parsed = postIdSchema.safeParse(id);
    if (!parsed.success) return notFound;
    const post = await dbGetPostById(parsed.data);
    return post ? { ok: true, data: post } : notFound;
  } catch (error) {
    return fail(error);
  }
}

// ------------------------------------------------------------------ mutations

export async function createPost(
  userId: string | null | undefined,
  input: unknown,
): Promise<Mutation> {
  try {
    const authorId = await assertAdmin(userId);
    const parsed = postInputSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error.issues);
    if (await dbFindPostIdBySlug(parsed.data.slug)) return slugTaken;
    const post = await dbCreatePost(authorId, parsed.data);
    return {
      ok: true,
      data: { post, change: { id: post.id, slugs: [post.slug] } },
    };
  } catch (error) {
    return fail(error);
  }
}

export async function updatePost(
  userId: string | null | undefined,
  id: unknown,
  patch: unknown,
): Promise<Mutation> {
  try {
    await assertAdmin(userId);
    const parsedId = postIdSchema.safeParse(id);
    if (!parsedId.success) return notFound;
    const parsed = postPatchSchema.safeParse(patch);
    if (!parsed.success) return invalid(parsed.error.issues);
    const current = await dbGetPostById(parsedId.data);
    if (!current) return notFound;
    if (parsed.data.slug && parsed.data.slug !== current.slug) {
      const owner = await dbFindPostIdBySlug(parsed.data.slug);
      if (owner && owner !== current.id) return slugTaken;
    }
    const post = await dbUpdatePost(current, parsed.data);
    return {
      ok: true,
      data: { post, change: { id: post.id, slugs: [current.slug, post.slug] } },
    };
  } catch (error) {
    return fail(error);
  }
}

export async function setPostStatus(
  userId: string | null | undefined,
  id: unknown,
  status: PostStatus,
): Promise<Mutation> {
  try {
    await assertAdmin(userId);
    const parsedId = postIdSchema.safeParse(id);
    if (!parsedId.success) return notFound;
    const current = await dbGetPostById(parsedId.data);
    if (!current) return notFound;
    if (status === "published" && current.blocks.length === 0) {
      return { ok: false, error: "Add some content before publishing." };
    }
    const post = await dbSetPostStatus(current.id, status);
    if (!post) return notFound;
    return {
      ok: true,
      data: { post, change: { id: post.id, slugs: [post.slug] } },
    };
  } catch (error) {
    return fail(error);
  }
}

export async function deletePost(
  userId: string | null | undefined,
  id: unknown,
): Promise<Mutation> {
  try {
    await assertAdmin(userId);
    const parsedId = postIdSchema.safeParse(id);
    if (!parsedId.success) return notFound;
    const post = await dbDeletePost(parsedId.data);
    if (!post) return notFound;
    return {
      ok: true,
      data: { post, change: { id: post.id, slugs: [post.slug] } },
    };
  } catch (error) {
    return fail(error);
  }
}

// --------------------------------------------------------------------- images

export type UploadedImage = { url: string };

/** Stores an image in Vercel Blob and returns its public URL. */
export async function uploadImage(
  userId: string | null | undefined,
  file: { name: string; type: string; size: number; body: Blob | ArrayBuffer },
): Promise<Result<UploadedImage>> {
  try {
    await assertAdmin(userId);
    if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) {
      return {
        ok: false,
        error: "Upload a PNG, JPEG, WebP, GIF or AVIF image.",
      };
    }
    if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
      return { ok: false, error: "Images must be under 4 MB." };
    }
    const safeName = file.name
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, "-")
      .slice(-80);
    const blob = await put(`posts/${safeName || "image"}`, file.body, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type,
    });
    return { ok: true, data: { url: blob.url } };
  } catch (error) {
    return fail(error);
  }
}
