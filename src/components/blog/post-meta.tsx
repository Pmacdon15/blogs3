import { CalendarDays, Clock, PencilLine } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format-date";
import { formatReadingTime } from "@/lib/reading-time";

/**
 * Whether a published post was edited on a later day than it went live.
 * Same-day fixes don't count, so "Updated" never repeats the publish date.
 */
export function wasUpdated(
  publishedAt: string | null,
  updatedAt?: string,
): updatedAt is string {
  if (!publishedAt || !updatedAt) return false;
  return (
    new Date(updatedAt).getTime() > new Date(publishedAt).getTime() &&
    formatDate(updatedAt) !== formatDate(publishedAt)
  );
}

function Dot() {
  return <span aria-hidden="true" className="size-1 rounded-full bg-line" />;
}

/**
 * Publish date, an "Updated" date when the post was edited after publishing,
 * and, when known, reading time, separated by dots.
 */
export function PostMeta({
  publishedAt,
  updatedAt,
  minutes,
  className,
}: {
  publishedAt: string | null;
  updatedAt?: string;
  minutes?: number;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 text-muted text-sm",
        className,
      )}
    >
      {publishedAt ? (
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays aria-hidden="true" className="size-4" />
          <time dateTime={publishedAt}>{formatDate(publishedAt)}</time>
        </span>
      ) : null}
      {wasUpdated(publishedAt, updatedAt) ? (
        <>
          <Dot />
          <span className="inline-flex items-center gap-1.5">
            <PencilLine aria-hidden="true" className="size-4" />
            <span>
              Updated on{" "}
              <time dateTime={updatedAt}>{formatDate(updatedAt)}</time>
            </span>
          </span>
        </>
      ) : null}
      {publishedAt && minutes ? <Dot /> : null}
      {minutes ? (
        <span className="inline-flex items-center gap-1.5">
          <Clock aria-hidden="true" className="size-4" />
          {formatReadingTime(minutes)}
        </span>
      ) : null}
    </p>
  );
}
