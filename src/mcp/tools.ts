import { z } from "zod";
import { dbSearchPublishedPosts } from "@/db/posts";
import { revalidatePostCaches } from "@/lib/cache/revalidate";
import { isAdmin } from "@/lib/dal/auth";
import {
  createPost as createPostInDal,
  deletePost as deletePostInDal,
  getPostForEdit,
  listPostsForAdmin,
  type Mutation,
  setPostStatus,
  updatePost,
  uploadImage as uploadImageInDal,
} from "@/lib/dal/posts";
import {
  type Block,
  blockSchema,
  CODE_LANGUAGES,
  codeBlockSchema,
  headingBlockSchema,
  IMAGE_TYPES,
  imageBlockSchema,
  MAX_BLOCKS,
  MAX_IMAGE_BYTES,
  postIdSchema,
  postInputSchema,
  searchQuerySchema,
  slugify,
  slugSchema,
  textBlockSchema,
} from "@/lib/schemas";
import type { Post, PostStatus, PostSummary } from "@/lib/types";

/*
 * The blog's MCP tools: everything an admin can do in the editor, as plain
 * functions of the verified caller's user id and the tool's arguments.
 *
 * - The user id only ever comes from the verified OAuth token (server.ts
 *   reads it from `extra.userId`); no tool takes one as an argument.
 * - Arguments are parsed with the shared zod schemas from src/lib/schemas.ts,
 *   and every read and write goes through the DAL, which checks the admin
 *   and validates again.
 * - After a successful write the caches are invalidated with
 *   `revalidatePostCaches` (route handlers can't use `updateTag`).
 */

export type ToolResult = {
  /** One or two sentences for the model (and hosts without app support). */
  summary: string;
  /** The same result as data: the tool's structuredContent, read by the apps. */
  data: Record<string, unknown>;
  isError?: boolean;
};

// -------------------------------------------------------------------- schemas

const post = postInputSchema.shape;

/** A block as a tool argument: the editor's block, with the id optional. */
export const newBlockSchema = z.discriminatedUnion("type", [
  headingBlockSchema.partial({ id: true }),
  textBlockSchema.partial({ id: true }),
  imageBlockSchema.partial({ id: true }),
  codeBlockSchema.partial({ id: true }),
]);
export type NewBlock = z.infer<typeof newBlockSchema>;

const newBlocks = z
  .array(newBlockSchema)
  .max(MAX_BLOCKS)
  .describe(
    "The post body, in order. Each block is a heading, text (paragraphs separated by blank lines), image (an https URL, e.g. from upload_image, with alt text) or code block. Block ids are optional; new blocks get one.",
  );

export const whoamiInputSchema = z.object({});

export const listPostsInputSchema = z.object({
  status: z
    .enum(["draft", "published"])
    .optional()
    .describe("Only posts with this status. Leave out for every post."),
});

export const getPostInputSchema = z
  .object({
    id: postIdSchema.optional().describe("The post's id."),
    slug: slugSchema.optional().describe("Or the post's slug."),
  })
  .refine((args) => Boolean(args.id || args.slug), {
    message: "Pass the post's id or slug.",
  });

export const searchPublishedPostsInputSchema = z.object({
  query: searchQuerySchema.shape.q.describe(
    "Words to look for in published titles, excerpts and tags. Empty lists the newest posts.",
  ),
  limit: z.number().int().min(1).max(50).default(10),
});

export const createPostInputSchema = z.object({
  title: post.title,
  slug: slugSchema
    .optional()
    .describe("URL slug. Defaults to one made from the title."),
  excerpt: post.excerpt.describe("A one or two sentence summary."),
  coverImageUrl: post.coverImageUrl.describe(
    "An https image URL for the cover, e.g. from upload_image.",
  ),
  tags: post.tags.describe("Up to 10 lowercase tags."),
  blocks: newBlocks.default([]),
});

export const updatePostInputSchema = z.object({
  id: postIdSchema,
  title: post.title.optional(),
  slug: slugSchema.optional(),
  excerpt: post.excerpt.unwrap().optional(),
  coverImageUrl: post.coverImageUrl
    .unwrap()
    .optional()
    .describe("An https image URL, or null to remove the cover."),
  tags: post.tags.unwrap().optional().describe("Replaces every tag."),
  blocks: newBlocks.optional().describe("Replaces the whole post body."),
});

export const addBlockInputSchema = z.object({
  postId: postIdSchema,
  block: newBlockSchema,
  position: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe("Zero-based index to insert at. Leave out to add at the end."),
});

const BLOCK_TYPES = ["heading", "text", "image", "code"] as const;

export const updateBlockInputSchema = z.object({
  postId: postIdSchema,
  blockId: z.string().min(1).max(64),
  changes: z
    .object({
      type: z.enum(BLOCK_TYPES).optional(),
      text: z.string().optional(),
      url: z.string().optional(),
      alt: z.string().optional(),
      caption: z.string().optional(),
      language: z.enum(CODE_LANGUAGES).optional(),
      code: z.string().optional(),
    })
    .refine((changes) => Object.keys(changes).length > 0, {
      message: "Say what to change.",
    })
    .describe(
      "The fields to change, e.g. { text } for a heading or text block, { url, alt, caption } for an image, { code, language } for code.",
    ),
});

export const removeBlockInputSchema = z.object({
  postId: postIdSchema,
  blockId: z.string().min(1).max(64),
});

export const moveBlockInputSchema = z.object({
  postId: postIdSchema,
  blockId: z.string().min(1).max(64),
  position: z
    .number()
    .int()
    .min(0)
    .describe("The block's new zero-based index."),
});

export const postIdInputSchema = z.object({ id: postIdSchema });

export const deletePostInputSchema = z.object({
  id: postIdSchema,
  confirm: z
    .literal(true)
    .describe(
      "Must be true, and only after the user has explicitly confirmed the deletion.",
    ),
});

export const uploadImageInputSchema = z
  .object({
    url: z
      .url({ protocol: /^https$/, message: "Image must be an https URL" })
      .optional()
      .describe("An https URL to download the image from."),
    data: z
      .string()
      .optional()
      .describe(
        "Or the image itself: a data: URL (data:image/png;base64,...) or plain base64 with contentType.",
      ),
    contentType: z.enum(IMAGE_TYPES).optional(),
    filename: z.string().trim().max(120).optional(),
  })
  .refine((args) => Boolean(args.url) !== Boolean(args.data), {
    message: "Pass either url or data.",
  });

// -------------------------------------------------------------------- helpers

const NOT_ADMIN = "You don't have permission to edit posts.";

function failure(result: {
  error: string;
  fieldErrors?: Record<string, string[]>;
}): ToolResult {
  return {
    summary: result.fieldErrors
      ? `${result.error} (${Object.entries(result.fieldErrors)
          .map(([field, errors]) => `${field}: ${errors.join(", ")}`)
          .join("; ")})`
      : result.error,
    data: {
      error: result.error,
      ...(result.fieldErrors ? { fieldErrors: result.fieldErrors } : {}),
    },
    isError: true,
  };
}

/** Where a post lives on the public site and in the editor. */
export function postLinks(post: { id: string; slug: string }) {
  return { path: `/blog/${post.slug}`, editPath: `/admin/posts/${post.id}` };
}

function describeBlock(block: Block, index: number) {
  const label = `${index}. [${block.type}] id=${block.id}`;
  switch (block.type) {
    case "heading":
    case "text":
      return `${label}: ${block.text.slice(0, 120)}`;
    case "image":
      return `${label}: ${block.url}${block.alt ? ` (${block.alt})` : ""}`;
    case "code":
      return `${label}: ${block.language}, ${block.code.split("\n").length} line(s)`;
  }
}

function postResult(post: Post, summary: string): ToolResult {
  const blocks = post.blocks.map(describeBlock).join("\n");
  return {
    summary: [
      summary,
      `"${post.title}" (${post.status}) id=${post.id} slug=${post.slug}`,
      blocks ? `Blocks:\n${blocks}` : "No blocks yet.",
    ].join("\n"),
    data: { view: "post", post, ...postLinks(post) },
  };
}

function listResult(
  posts: PostSummary[],
  summary: string,
  extra: Record<string, unknown>,
): ToolResult {
  const lines = posts.map(
    (p) => `- "${p.title}" (${p.status}) id=${p.id} slug=${p.slug}`,
  );
  return {
    summary: [summary, ...lines].join("\n"),
    data: { view: "posts", posts, count: posts.length, ...extra },
  };
}

function afterMutation(result: Mutation, summary: (post: Post) => string) {
  if (!result.ok) return failure(result);
  revalidatePostCaches(result.data.change);
  return postResult(result.data.post, summary(result.data.post));
}

/** Gives every new block an id that isn't used in the post yet. */
function withIds(blocks: NewBlock[], existing: Block[] = []): Block[] {
  const used = new Set(existing.map((b) => b.id));
  return blocks.map((block) => {
    let id = block.id;
    while (!id || used.has(id)) id = crypto.randomUUID();
    used.add(id);
    return { ...block, id } as Block;
  });
}

/**
 * Every editable field of `current` with `changes` on top, so a write never
 * relies on the patch schema leaving untouched fields alone.
 */
function fullPost(
  current: Post,
  changes: Partial<
    Pick<Post, "title" | "slug" | "excerpt" | "coverImageUrl" | "tags">
  > & { blocks?: Block[] },
) {
  return {
    title: changes.title ?? current.title,
    slug: changes.slug ?? current.slug,
    excerpt: changes.excerpt ?? current.excerpt,
    coverImageUrl:
      changes.coverImageUrl === undefined
        ? current.coverImageUrl
        : changes.coverImageUrl,
    tags: changes.tags ?? current.tags,
    blocks: changes.blocks ?? current.blocks,
  };
}

/** Loads a post, changes its blocks with `edit`, and saves it. */
async function editBlocks(
  userId: string,
  postId: string,
  edit: (blocks: Block[]) => Block[] | string,
  summary: string,
) {
  const current = await getPostForEdit(userId, postId);
  if (!current.ok) return failure(current);
  const blocks = edit([...current.data.blocks]);
  if (typeof blocks === "string") return failure({ error: blocks });
  const saved = await updatePost(
    userId,
    postId,
    fullPost(current.data, { blocks }),
  );
  return afterMutation(saved, () => summary);
}

const blockNotFound = (blockId: string) =>
  `No block with id ${blockId} in this post.`;

// ---------------------------------------------------------------------- tools

export async function whoami(userId: string): Promise<ToolResult> {
  const admin = await isAdmin(userId);
  return {
    summary: admin
      ? `Signed in as ${userId}, an admin: you can create, edit, publish and delete posts.`
      : `Signed in as ${userId}, who isn't an admin: only search_published_posts is available.`,
    data: { userId, isAdmin: admin },
  };
}

export async function listPosts(
  userId: string,
  args: unknown,
): Promise<ToolResult> {
  const { status } = listPostsInputSchema.parse(args);
  const result = await listPostsForAdmin(userId);
  if (!result.ok) return failure(result);
  const posts = status
    ? result.data.filter((p) => p.status === status)
    : result.data;
  const drafts = posts.filter((p) => p.status === "draft").length;
  return listResult(
    posts,
    `${posts.length} post(s): ${drafts} draft(s), ${posts.length - drafts} published.`,
    { status: status ?? "all" },
  );
}

export async function getPost(
  userId: string,
  args: unknown,
): Promise<ToolResult> {
  const { id, slug } = getPostInputSchema.parse(args);
  let postId = id;
  if (!postId) {
    const list = await listPostsForAdmin(userId);
    if (!list.ok) return failure(list);
    postId = list.data.find((p) => p.slug === slug)?.id;
    if (!postId) return failure({ error: "Post not found." });
  }
  const result = await getPostForEdit(userId, postId);
  if (!result.ok) return failure(result);
  return postResult(result.data, "Here's the post.");
}

export async function searchPublishedPosts(
  _userId: string,
  args: unknown,
): Promise<ToolResult> {
  const { query, limit } = searchPublishedPostsInputSchema.parse(args);
  const posts = await dbSearchPublishedPosts(query, limit);
  return listResult(
    posts,
    query
      ? `${posts.length} published post(s) match "${query}".`
      : `The ${posts.length} newest published post(s).`,
    { query },
  );
}

export async function createPost(
  userId: string,
  args: unknown,
): Promise<ToolResult> {
  const input = createPostInputSchema.parse(args);
  const result = await createPostInDal(userId, {
    ...input,
    slug: input.slug ?? slugify(input.title),
    blocks: withIds(input.blocks),
  });
  return afterMutation(result, () => "Created a draft.");
}

export async function updatePostTool(
  userId: string,
  args: unknown,
): Promise<ToolResult> {
  const { id, blocks, ...changes } = updatePostInputSchema.parse(args);
  if (Object.keys(changes).length === 0 && !blocks) {
    return failure({ error: "Nothing to update." });
  }
  const current = await getPostForEdit(userId, id);
  if (!current.ok) return failure(current);
  const result = await updatePost(
    userId,
    id,
    fullPost(current.data, {
      ...changes,
      blocks: blocks && withIds(blocks),
    }),
  );
  return afterMutation(result, () => "Saved.");
}

export async function addBlock(
  userId: string,
  args: unknown,
): Promise<ToolResult> {
  const { postId, block, position } = addBlockInputSchema.parse(args);
  return editBlocks(
    userId,
    postId,
    (blocks) => {
      const [added] = withIds([block], blocks);
      blocks.splice(position ?? blocks.length, 0, added);
      return blocks;
    },
    `Added a ${block.type} block.`,
  );
}

export async function updateBlock(
  userId: string,
  args: unknown,
): Promise<ToolResult> {
  const { postId, blockId, changes } = updateBlockInputSchema.parse(args);
  return editBlocks(
    userId,
    postId,
    (blocks) => {
      const index = blocks.findIndex((b) => b.id === blockId);
      if (index === -1) return blockNotFound(blockId);
      const next = blockSchema.safeParse({
        ...blocks[index],
        ...changes,
        id: blockId,
      });
      if (!next.success) return next.error.issues[0].message;
      blocks[index] = next.data;
      return blocks;
    },
    "Updated the block.",
  );
}

export async function removeBlock(
  userId: string,
  args: unknown,
): Promise<ToolResult> {
  const { postId, blockId } = removeBlockInputSchema.parse(args);
  return editBlocks(
    userId,
    postId,
    (blocks) => {
      const index = blocks.findIndex((b) => b.id === blockId);
      if (index === -1) return blockNotFound(blockId);
      blocks.splice(index, 1);
      return blocks;
    },
    "Removed the block.",
  );
}

export async function moveBlock(
  userId: string,
  args: unknown,
): Promise<ToolResult> {
  const { postId, blockId, position } = moveBlockInputSchema.parse(args);
  return editBlocks(
    userId,
    postId,
    (blocks) => {
      const index = blocks.findIndex((b) => b.id === blockId);
      if (index === -1) return blockNotFound(blockId);
      const [block] = blocks.splice(index, 1);
      blocks.splice(Math.min(position, blocks.length), 0, block);
      return blocks;
    },
    "Moved the block.",
  );
}

async function setStatus(userId: string, args: unknown, status: PostStatus) {
  const { id } = postIdInputSchema.parse(args);
  const result = await setPostStatus(userId, id, status);
  return afterMutation(result, (p) =>
    status === "published"
      ? `Published. It's live at ${postLinks(p).path}.`
      : "Unpublished: it's a draft again.",
  );
}

export const publishPost = (userId: string, args: unknown) =>
  setStatus(userId, args, "published");

export const unpublishPost = (userId: string, args: unknown) =>
  setStatus(userId, args, "draft");

export async function deletePost(
  userId: string,
  args: unknown,
): Promise<ToolResult> {
  const { id } = deletePostInputSchema.parse(args);
  const result = await deletePostInDal(userId, id);
  if (!result.ok) return failure(result);
  revalidatePostCaches(result.data.change);
  const { post: deleted } = result.data;
  return {
    summary: `Deleted "${deleted.title}". This can't be undone.`,
    data: {
      deleted: { id: deleted.id, slug: deleted.slug, title: deleted.title },
    },
  };
}

// --------------------------------------------------------------------- images

type ImageFile = { name: string; type: string; size: number; body: Blob };

/**
 * Whether a URL's host may be fetched: a public DNS name, never localhost,
 * an internal name or an IP literal, so the server can't be pointed at its
 * own network.
 */
export function isFetchableHost(hostname: string) {
  const host = hostname.toLowerCase();
  if (!host.includes(".") || host.includes(":")) return false;
  if (/^\d+(\.\d+){3}$/.test(host)) return false;
  return !/\.(localhost|local|internal|lan|home|corp)$/.test(host);
}

const tooBig = { error: "Images must be under 4 MB." };

async function downloadImage(
  url: string,
  filename: string | undefined,
): Promise<ImageFile | { error: string }> {
  const parsed = new URL(url);
  if (!isFetchableHost(parsed.hostname)) {
    return { error: "That image host can't be reached from the blog." };
  }
  let res: Response;
  try {
    res = await fetch(parsed, {
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
      headers: { accept: IMAGE_TYPES.join(", ") },
    });
  } catch {
    return {
      error:
        "Couldn't download that image. Redirects aren't followed, so use the image's final URL.",
    };
  }
  if (!res.ok) {
    return { error: `Couldn't download that image (HTTP ${res.status}).` };
  }
  if (Number(res.headers.get("content-length")) > MAX_IMAGE_BYTES) {
    return tooBig;
  }
  const type = (res.headers.get("content-type") ?? "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  const body = await res.blob();
  const name = filename || parsed.pathname.split("/").pop() || "image";
  return { name, type, size: body.size, body };
}

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

function decodeImage(
  data: string,
  contentType: string | undefined,
  filename: string | undefined,
): ImageFile | { error: string } {
  const match = /^data:([^;,]+)(?:;[^,]*)?;base64,([\s\S]*)$/.exec(data.trim());
  const type = match?.[1].toLowerCase() ?? contentType;
  const base64 = (match ? match[2] : data).replace(/\s+/g, "");
  if (!type) {
    return { error: "Pass contentType with plain base64 data." };
  }
  if (!BASE64.test(base64)) {
    return { error: "The image data isn't valid base64." };
  }
  if ((base64.length * 3) / 4 - 2 > MAX_IMAGE_BYTES) return tooBig;
  const bytes = Uint8Array.from(Buffer.from(base64, "base64"));
  const extension = type.split("/")[1];
  return {
    name: filename || `image.${extension}`,
    type,
    size: bytes.byteLength,
    body: new Blob([bytes], { type }),
  };
}

export async function uploadImage(
  userId: string,
  args: unknown,
): Promise<ToolResult> {
  const { url, data, contentType, filename } =
    uploadImageInputSchema.parse(args);
  // Only admins get the server to download anything.
  if (!(await isAdmin(userId))) return failure({ error: NOT_ADMIN });
  const file = url
    ? await downloadImage(url, filename)
    : decodeImage(data as string, contentType, filename);
  if ("error" in file) return failure(file);
  const result = await uploadImageInDal(userId, file);
  if (!result.ok) return failure(result);
  return {
    summary: `Uploaded the image: ${result.data.url}\nUse it in an image block ({ "type": "image", "url": "${result.data.url}", "alt": "..." }) or as coverImageUrl.`,
    data: {
      url: result.data.url,
      block: { type: "image", url: result.data.url, alt: "" },
    },
  };
}
