import { CalendarDays, Clock } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format-date";
import { formatReadingTime } from "@/lib/reading-time";

/** Publish date and, when known, reading time, separated by a dot. */
export function PostMeta({
  publishedAt,
  minutes,
  className,
}: {
  publishedAt: string | null;
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
      {publishedAt && minutes ? (
        <span aria-hidden="true" className="size-1 rounded-full bg-line" />
      ) : null}
      {minutes ? (
        <span className="inline-flex items-center gap-1.5">
          <Clock aria-hidden="true" className="size-4" />
          {formatReadingTime(minutes)}
        </span>
      ) : null}
    </p>
  );
}
