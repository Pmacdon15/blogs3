import "server-only";
import { revalidateTag, updateTag } from "next/cache";
import { type PostChange, postChangeTags } from "@/lib/cache/tags";

/*
 * The only places cache tags are invalidated.
 *
 * - Server actions call `updatePostCaches`: `updateTag` gives the editor
 *   read-your-own-writes on the very next render.
 * - Route handlers (the MCP server, webhooks) can't call `updateTag`, so they
 *   call `revalidatePostCaches`: `revalidateTag` with `expire: 0`, so the next
 *   visitor gets fresh data rather than a stale page.
 */

export function updatePostCaches(change: PostChange) {
  for (const tag of postChangeTags(change)) updateTag(tag);
}

export function revalidatePostCaches(change: PostChange) {
  for (const tag of postChangeTags(change)) revalidateTag(tag, { expire: 0 });
}
