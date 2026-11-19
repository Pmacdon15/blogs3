import { PostRows, parseStatusFilter } from "@/components/admin/post-rows";
import { StatusTabs } from "@/components/admin/status-tabs";
import { requireAdminPage } from "@/lib/dal/auth";
import { listPostsForAdmin } from "@/lib/dal/posts";
import type { PostSummary } from "@/lib/types";

/*
 * The dashboard's Suspense holes. Each reads the URL first (when it needs
 * it), then the session, then the posts. requireAdminPage is per-request
 * memoized and the admin list is cached in the db layer, so the holes
 * share one read.
 */

async function adminPosts(): Promise<PostSummary[]> {
  const userId = await requireAdminPage();
  const result = await listPostsForAdmin(userId);
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

export async function PostRowsHole({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const { status } = await searchParams;
  const posts = await adminPosts();
  return <PostRows filter={parseStatusFilter(status)} posts={posts} />;
}

export type StatKind = "total" | "published" | "draft";

export async function StatValue({
  kind,
  searchParams,
}: {
  kind: StatKind;
  searchParams: Promise<unknown>;
}) {
  // The URL first, so the shell never reads the session.
  await searchParams;
  const posts = await adminPosts();
  const count =
    kind === "total"
      ? posts.length
      : posts.filter((post) => post.status === kind).length;
  return <>{count}</>;
}

/** The filter tabs with the one in the URL marked current. */
export async function ActiveStatusTabs({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const { status } = await searchParams;
  return <StatusTabs active={parseStatusFilter(status)} />;
}
