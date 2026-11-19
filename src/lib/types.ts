import type { Block } from "@/lib/schemas";

export type PostStatus = "draft" | "published";

/** A post as stored. Dates are ISO strings so they cross the cache and RSC boundary. */
export type Post = {
  id: string;
  authorId: string;
  slug: string;
  title: string;
  excerpt: string;
  coverImageUrl: string | null;
  blocks: Block[];
  tags: string[];
  status: PostStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** What lists and search results need: no blocks. */
export type PostSummary = Omit<Post, "blocks" | "authorId">;

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
