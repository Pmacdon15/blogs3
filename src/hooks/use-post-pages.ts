import { useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";
import { postSummarySchema } from "@/hooks/use-post-search";
import { type PostCursor, postCursorSchema } from "@/lib/schemas";
import type { PostPage } from "@/lib/types";

/** What GET /api/posts returns. */
export const postPageSchema = z.object({
  posts: z.array(postSummarySchema),
  nextCursor: postCursorSchema.nullable(),
}) satisfies z.ZodType<PostPage>;

export async function fetchPostPage(
  cursor: PostCursor,
  signal?: AbortSignal,
): Promise<PostPage> {
  const params = new URLSearchParams(cursor);
  const response = await fetch(`/api/posts?${params}`, { signal });
  if (!response.ok)
    throw new Error(`Loading posts failed (${response.status})`);
  return postPageSchema.parse(await response.json());
}

/**
 * Pages of published posts after the ones the server already rendered. Starts
 * from an empty page holding `cursor`, so nothing loads until `fetchNextPage`.
 */
export function usePostPages(cursor: PostCursor) {
  return useInfiniteQuery({
    queryKey: ["post-pages", cursor],
    queryFn: ({ pageParam, signal }) => fetchPostPage(pageParam, signal),
    initialPageParam: cursor,
    getNextPageParam: (last: PostPage) => last.nextCursor ?? undefined,
    initialData: {
      pages: [{ posts: [], nextCursor: cursor }],
      pageParams: [cursor],
    },
    staleTime: Number.POSITIVE_INFINITY,
  });
}
