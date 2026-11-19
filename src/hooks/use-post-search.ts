import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import type { PostSummary } from "@/lib/types";

/** Shortest query the search API answers with results. */
export const MIN_SEARCH_LENGTH = 2;

export const postSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  excerpt: z.string(),
  coverImageUrl: z.string().nullable(),
  tags: z.array(z.string()),
  status: z.enum(["draft", "published"]),
  publishedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
}) satisfies z.ZodType<PostSummary>;

/** What GET /api/posts/search returns. */
export const searchResponseSchema = z.object({
  results: z.array(postSummarySchema),
});

export type SearchResponse = z.infer<typeof searchResponseSchema>;

export async function fetchPostSearch(
  q: string,
  signal?: AbortSignal,
): Promise<PostSummary[]> {
  const response = await fetch(`/api/posts/search?q=${encodeURIComponent(q)}`, {
    signal,
  });
  if (!response.ok) throw new Error(`Search failed (${response.status})`);
  return searchResponseSchema.parse(await response.json()).results;
}

/** Published posts matching `q`. Idle until `q` has at least 2 characters. */
export function usePostSearch(q: string) {
  return useQuery({
    queryKey: ["post-search", q],
    queryFn: ({ signal }) => fetchPostSearch(q, signal),
    enabled: q.trim().length >= MIN_SEARCH_LENGTH,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}
