import type { Metadata } from "next";
import { Suspense } from "react";
import { EditorSkeleton, EditPostHole } from "@/components/admin/editor-holes";

export const metadata: Metadata = { title: "Edit post" };

export default function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <h1 className="font-semibold text-muted text-sm uppercase tracking-wide">
        Edit post
      </h1>
      <Suspense fallback={<EditorSkeleton />}>
        <EditPostHole params={params} />
      </Suspense>
    </div>
  );
}
