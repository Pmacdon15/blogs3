import { type Block, type PostInput, postInputSchema } from "@/lib/schemas";
import type { Post } from "@/lib/types";

/*
 * The editor's working copy of a post. Fields are plain strings while
 * editing (an empty cover is ""), and `toInput` shapes them for the schema.
 */
export type Draft = {
  title: string;
  slug: string;
  excerpt: string;
  coverImageUrl: string;
  tags: string[];
  blocks: Block[];
};

export const emptyDraft: Draft = {
  title: "",
  slug: "",
  excerpt: "",
  coverImageUrl: "",
  tags: [],
  blocks: [],
};

export function draftFromPost(post: Post): Draft {
  return {
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    coverImageUrl: post.coverImageUrl ?? "",
    tags: post.tags,
    blocks: post.blocks.map((block) =>
      block.type === "image"
        ? { ...block, caption: block.caption ?? "" }
        : block,
    ),
  };
}

/** The draft as the schema expects it: no empty cover, no empty captions. */
export function toInput(draft: Draft) {
  return {
    ...draft,
    coverImageUrl: draft.coverImageUrl.trim() || null,
    blocks: draft.blocks.map((block) => {
      if (block.type !== "image") return block;
      const { caption, ...rest } = block;
      return caption?.trim() ? { ...rest, caption } : rest;
    }),
  };
}

/** A stable string for comparing drafts (the dirty check). */
export function snapshot(draft: Draft) {
  return JSON.stringify(toInput(draft));
}

export type Validation =
  | { ok: true; input: PostInput }
  | { ok: false; errors: Record<string, string[]> };

/** Validates with the same schema the server uses; errors keyed like the DAL's ("blocks.2.text"). */
export function validateDraft(draft: Draft): Validation {
  const parsed = postInputSchema.safeParse(toInput(draft));
  if (parsed.success) return { ok: true, input: parsed.data };
  const errors: Record<string, string[]> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path.map(String).join(".");
    errors[key] = [...(errors[key] ?? []), issue.message];
  }
  return { ok: false, errors };
}
