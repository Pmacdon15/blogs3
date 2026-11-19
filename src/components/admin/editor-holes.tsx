import { notFound } from "next/navigation";
import { PostEditor } from "@/components/admin/post-editor";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdminPage } from "@/lib/dal/auth";
import { getPostForEdit } from "@/lib/dal/posts";

/*
 * The editor pages' Suspense holes: the URL first, then the session, then
 * the post.
 */

export async function NewPostHole({
  searchParams,
}: {
  searchParams: Promise<unknown>;
}) {
  await searchParams;
  await requireAdminPage();
  return <PostEditor mode="create" />;
}

export async function EditPostHole({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await requireAdminPage();
  const result = await getPostForEdit(userId, id);
  if (!result.ok) notFound();
  return <PostEditor mode="edit" post={result.data} />;
}

/** Sized like the editor: toolbar, title, body and the details panel. */
export function EditorSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4">
      <Skeleton className="h-11 w-full rounded-lg" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-11 w-3/4" />
          <Skeleton className="h-11 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    </div>
  );
}
