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

const IMAGE_EXT_BY_TYPE: Record<(typeof IMAGE_TYPES)[number], string> = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

const ALLOWED_IMAGE_EXTS = new Set([
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "avif",
]);

function startsWith(bytes: Uint8Array, prefix: number[], offset = 0): boolean {
  if (bytes.length < offset + prefix.length) return false;
  return prefix.every((b, i) => bytes[offset + i] === b);
}

/** Checks that the leading magic bytes match the declared image MIME type. */
export function matchesImageSignature(
  type: string,
  bytes: Uint8Array,
): boolean {
  switch (type) {
    case "image/png":
      return startsWith(
        bytes,
        [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
      );
    case "image/jpeg":
      return startsWith(bytes, [0xff, 0xd8, 0xff]);
    case "image/gif":
      return (
        startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
        startsWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
      );
    case "image/webp":
      return (
        startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
        startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
      );
    case "image/avif":
      return (
        startsWith(bytes, [0x66, 0x74, 0x79, 0x70], 4) &&
        (startsWith(bytes, [0x61, 0x76, 0x69, 0x66], 8) ||
          startsWith(bytes, [0x61, 0x76, 0x69, 0x73], 8) ||
          startsWith(bytes, [0x6d, 0x69, 0x66, 0x31], 8))
      );
    default:
      return false;
  }
}

function sanitizeImageFilename(
  name: string,
  type: (typeof IMAGE_TYPES)[number],
): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .slice(-80);
  if (!cleaned) return "image";
  const dot = cleaned.lastIndexOf(".");
  if (dot === -1) return cleaned;
  const ext = cleaned.slice(dot + 1);
  if (ALLOWED_IMAGE_EXTS.has(ext)) return cleaned;
  const base = cleaned.slice(0, dot) || "image";
  return `${base}.${IMAGE_EXT_BY_TYPE[type]}`;
}

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
    const buffer =
      file.body instanceof Blob ? await file.body.arrayBuffer() : file.body;
    if (!matchesImageSignature(file.type, new Uint8Array(buffer))) {
      return {
        ok: false,
        error: "Upload a PNG, JPEG, WebP, GIF or AVIF image.",
      };
    }
    const safeName = sanitizeImageFilename(
      file.name,
      file.type as (typeof IMAGE_TYPES)[number],
    );
    const blob = await put(`posts/${safeName}`, file.body, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type,
    });
    return { ok: true, data: { url: blob.url } };
  } catch (error) {
    return fail(error);
  }
}
