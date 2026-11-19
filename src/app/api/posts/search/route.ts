import { cacheLife, cacheTag } from "next/cache";
import { dbSearchPublishedPosts } from "@/db/posts";
import { CACHE_TAGS } from "@/lib/cache/tags";
import { searchQuerySchema } from "@/lib/schemas";
import type { PostSummary } from "@/lib/types";

/** Shorter queries match too much to be useful: they get no results. */
const MIN_SEARCH_LENGTH = 2;

/** Browsers keep a result for a minute; the CDN serves it stale while it refreshes. */
const CACHE_CONTROL =
  "public, max-age=60, s-maxage=300, stale-while-revalidate=600";

/** Cached per (lower-cased) query; any post change clears every search. */
async function searchPublishedPosts(q: string): Promise<PostSummary[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.publishedPosts);
  return dbSearchPublishedPosts(q);
}

/** GET /api/posts/search?q=… → { results: PostSummary[] } */
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("q");
  const parsed = searchQuerySchema.safeParse({ q: raw ?? undefined });
  if (!parsed.success) {
    return Response.json(
      { error: "Search query must be at most 100 characters." },
      { status: 400 },
    );
  }

  const q = parsed.data.q.toLowerCase();
  const results =
    q.length < MIN_SEARCH_LENGTH ? [] : await searchPublishedPosts(q);
  return Response.json(
    { results },
    { headers: { "Cache-Control": CACHE_CONTROL } },
  );
}
