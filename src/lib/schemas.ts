import { z } from "zod";

/*
 * Shared validation for posts. The editor validates with these before calling
 * an action, and every server entry point (actions, MCP tools, API routes)
 * parses with them again, so the client is never trusted.
 */

export const CODE_LANGUAGES = [
  "plaintext",
  "typescript",
  "javascript",
  "tsx",
  "jsx",
  "json",
  "html",
  "css",
  "bash",
  "python",
  "sql",
  "go",
  "rust",
  "yaml",
  "markdown",
] as const;

export const MAX_BLOCKS = 200;
export const MAX_TAGS = 10;
export const MIN_IMAGE_WIDTH = 20;
export const MAX_IMAGE_WIDTH = 100;

export function clampImageWidth(width: number) {
  return Math.min(
    MAX_IMAGE_WIDTH,
    Math.max(MIN_IMAGE_WIDTH, Math.round(width)),
  );
}

const blockId = z.string().trim().min(1).max(64);

export const headingBlockSchema = z.object({
  id: blockId,
  type: z.literal("heading"),
  text: z.string().trim().min(1, "Heading can't be empty").max(200),
});

export const textBlockSchema = z.object({
  id: blockId,
  type: z.literal("text"),
  text: z.string().trim().min(1, "Text can't be empty").max(20_000),
});

export const imageBlockSchema = z.object({
  id: blockId,
  type: z.literal("image"),
  url: z.url({ protocol: /^https$/, message: "Image must be an https URL" }),
  alt: z.string().trim().max(300).default(""),
  caption: z.string().trim().max(300).optional(),
  width: z.number().int().min(MIN_IMAGE_WIDTH).max(MAX_IMAGE_WIDTH).optional(),
});

export const codeBlockSchema = z.object({
  id: blockId,
  type: z.literal("code"),
  language: z.enum(CODE_LANGUAGES).default("plaintext"),
  code: z.string().min(1, "Code can't be empty").max(20_000),
});

export const blockSchema = z.discriminatedUnion("type", [
  headingBlockSchema,
  textBlockSchema,
  imageBlockSchema,
  codeBlockSchema,
]);

export const slugSchema = z
  .string()
  .trim()
  .min(1, "Slug is required")
  .max(120)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers and single dashes",
  );

export const postInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(160),
  slug: slugSchema,
  excerpt: z.string().trim().max(300).default(""),
  coverImageUrl: z
    .url({ protocol: /^https$/, message: "Cover must be an https URL" })
    .nullable()
    .default(null),
  tags: z
    .array(z.string().trim().toLowerCase().min(1).max(32))
    .max(MAX_TAGS)
    .default([]),
  blocks: z.array(blockSchema).max(MAX_BLOCKS).default([]),
});

/**
 * Partial update: any subset of the post fields. Built from the fields
 * without their defaults, so a field the patch leaves out stays undefined
 * (and untouched in the db) instead of being reset to "" / [] / null.
 */
const inputShape = postInputSchema.shape;
export const postPatchSchema = z.object({
  title: inputShape.title.optional(),
  slug: inputShape.slug.optional(),
  excerpt: inputShape.excerpt.removeDefault().optional(),
  coverImageUrl: inputShape.coverImageUrl.removeDefault().optional(),
  tags: inputShape.tags.removeDefault().optional(),
  blocks: inputShape.blocks.removeDefault().optional(),
});

export const postIdSchema = z.uuid("Not a valid post id");

export const searchQuerySchema = z.object({
  q: z.string().trim().max(100).default(""),
});

/** Where the next page of published posts starts: after this post. */
export const postCursorSchema = z.object({
  before: z.iso.datetime(),
  beforeId: z.uuid(),
});

export type PostCursor = z.infer<typeof postCursorSchema>;

export const IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
] as const;
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export type Block = z.infer<typeof blockSchema>;
export type BlockType = Block["type"];
export type PostInput = z.infer<typeof postInputSchema>;
export type PostPatch = z.infer<typeof postPatchSchema>;

/** A URL-safe slug from a title: "Hello, World!" → "hello-world". */
export function slugify(title: string) {
  return title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
    .replace(/-+$/g, "");
}
