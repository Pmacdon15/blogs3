import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  ActiveStatusTabs,
  PostRowsHole,
  type StatKind,
  StatValue,
} from "@/components/admin/dashboard";
import { StatusTabs } from "@/components/admin/status-tabs";
import { buttonClasses } from "@/components/ui/button";
import { Skeleton, TableRowsSkeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Posts" };

const STATS: { kind: StatKind; label: string }[] = [
  { kind: "total", label: "Total posts" },
  { kind: "published", label: "Published" },
  { kind: "draft", label: "Drafts" },
];

/** The posts dashboard. The frame is static; counts, tabs and rows are holes. */
export default function AdminPostsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-semibold text-2xl text-ink tracking-tight">
            Posts
          </h1>
          <p className="text-muted text-sm">Drafts and published posts.</p>
        </div>
        <Link
          className={buttonClasses("primary", "md")}
          href="/admin/posts/new"
        >
          <Plus aria-hidden="true" className="size-4" />
          New post
        </Link>
      </header>

      <dl className="grid grid-cols-3 gap-3">
        {STATS.map((stat) => (
          <div
            className="rounded-xl border border-line bg-surface px-4 py-3 shadow-xs"
            key={stat.kind}
          >
            <dt className="text-muted text-xs">{stat.label}</dt>
            <dd className="mt-1 h-8 font-semibold text-2xl text-ink tabular-nums">
              <Suspense fallback={<Skeleton className="h-7 w-10" />}>
                <StatValue kind={stat.kind} searchParams={searchParams} />
              </Suspense>
            </dd>
          </div>
        ))}
      </dl>

      <section
        aria-label="All posts"
        className="overflow-hidden rounded-xl border border-line bg-surface shadow-xs"
      >
        <div className="flex items-center justify-between gap-3 border-line border-b px-3 py-2">
          <Suspense fallback={<StatusTabs />}>
            <ActiveStatusTabs searchParams={searchParams} />
          </Suspense>
        </div>
        <table className="w-full table-fixed text-left">
          <thead className="bg-canvas text-muted text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-2 font-medium" scope="col">
                Title
              </th>
              <th className="w-28 px-4 py-2 font-medium" scope="col">
                Status
              </th>
              <th
                className="hidden w-32 px-4 py-2 font-medium sm:table-cell"
                scope="col"
              >
                Updated
              </th>
              <th className="w-36 px-4 py-2 text-right font-medium" scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            <Suspense fallback={<TableRowsSkeleton cols={4} rows={5} />}>
              <PostRowsHole searchParams={searchParams} />
            </Suspense>
          </tbody>
        </table>
      </section>
    </div>
  );
}
