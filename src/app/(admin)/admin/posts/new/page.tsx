import type { Metadata } from "next";
import { Suspense } from "react";
import { EditorSkeleton, NewPostHole } from "@/components/admin/editor-holes";

export const metadata: Metadata = { title: "New post" };

export default function NewPostPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <h1 className="font-semibold text-muted text-sm uppercase tracking-wide">
        New post
      </h1>
      <Suspense fallback={<EditorSkeleton />}>
        <NewPostHole searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
