import { cacheLife, cacheTag } from "next/cache";
import { dbListPublishedPosts, PAGE_SIZE } from "@/db/posts";
import { CACHE_TAGS } from "@/lib/cache/tags";
import { type PostCursor, postCursorSchema } from "@/lib/schemas";
import type { PostPage } from "@/lib/types";

/** Browsers keep a page for a minute; the CDN serves it stale while it refreshes. */
const CACHE_CONTROL =
  "public, max-age=60, s-maxage=300, stale-while-revalidate=600";

/** Cached per cursor; any post change clears every page. */
async function listPublishedPage(cursor: PostCursor): Promise<PostPage> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CACHE_TAGS.publishedPosts);
  return dbListPublishedPosts(PAGE_SIZE, cursor);
}

/** GET /api/posts?before=<ISO date>&beforeId=<uuid> → the page after that post. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const parsed = postCursorSchema.safeParse({
    before: params.get("before") ?? undefined,
    beforeId: params.get("beforeId") ?? undefined,
  });
  if (!parsed.success) {
    return Response.json(
      { error: "Pass the cursor from the previous page." },
      { status: 400 },
    );
  }
  return Response.json(await listPublishedPage(parsed.data), {
    headers: { "Cache-Control": CACHE_CONTROL },
  });
}
