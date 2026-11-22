import type { Block, PostCursor } from "@/lib/schemas";

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

/** One page of published posts and where the next one starts (null: last page). */
export type PostPage = { posts: PostSummary[]; nextCursor: PostCursor | null };

/** Minimal fields needed to build sitemap entries without loading post bodies. */
export type SitemapPost = Pick<Post, "slug" | "updatedAt" | "coverImageUrl">;

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
