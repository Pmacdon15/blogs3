import Link from "next/link";
import { editPath, postPath } from "@/components/admin/paths";
import { StatusBadge } from "@/components/admin/status-badge";
import { buttonClasses } from "@/components/ui/button";
import type { PostStatus, PostSummary } from "@/lib/types";

export type StatusFilter = PostStatus | "all";

/** The filter from `?status=`: anything unknown means all posts. */
export function parseStatusFilter(value: unknown): StatusFilter {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "draft" || raw === "published" ? raw : "all";
}

const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export function formatDate(iso: string) {
  return dateFormat.format(new Date(iso));
}

/** Table rows for the dashboard (server-rendered). */
export function PostRows({
  posts,
  filter,
}: {
  posts: PostSummary[];
  filter: StatusFilter;
}) {
  const shown =
    filter === "all" ? posts : posts.filter((post) => post.status === filter);

  if (shown.length === 0) {
    return (
      <tr>
        <td className="px-4 py-12 text-center text-muted text-sm" colSpan={4}>
          {filter === "all" ? (
            <>
              No posts yet.{" "}
              <Link
                className="font-medium text-brand-700 hover:underline"
                href="/admin/posts/new"
              >
                Write your first one
              </Link>
              .
            </>
          ) : filter === "draft" ? (
            "No drafts."
          ) : (
            "Nothing published yet."
          )}
        </td>
      </tr>
    );
  }

  return (
    <>
      {shown.map((post) => (
        <tr className="group hover:bg-brand-50/40" key={post.id}>
          <td className="max-w-0 px-4 py-2.5">
            <Link
              className="block truncate font-medium text-ink group-hover:text-brand-700"
              href={editPath(post.id)}
            >
              {post.title}
            </Link>
            <span className="block truncate font-mono text-muted text-xs">
              /{post.slug}
            </span>
          </td>
          <td className="px-4 py-2.5">
            <StatusBadge status={post.status} />
          </td>
          <td className="hidden whitespace-nowrap px-4 py-2.5 text-muted text-sm sm:table-cell">
            <time dateTime={post.updatedAt}>{formatDate(post.updatedAt)}</time>
          </td>
          <td className="whitespace-nowrap px-4 py-2.5 text-right">
            <div className="inline-flex gap-1">
              <Link
                aria-label={`Edit ${post.title}`}
                className={buttonClasses("secondary", "sm")}
                href={editPath(post.id)}
              >
                Edit
              </Link>
              {post.status === "published" ? (
                <Link
                  aria-label={`View ${post.title}`}
                  className={buttonClasses("ghost", "sm")}
                  href={postPath(post.slug)}
                >
                  View
                </Link>
              ) : null}
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}
