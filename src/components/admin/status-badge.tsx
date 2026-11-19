import { cn } from "@/lib/cn";
import type { PostStatus } from "@/lib/types";

const STYLES: Record<PostStatus, string> = {
  draft: "bg-amber-50 text-amber-800 ring-amber-200",
  published: "bg-emerald-50 text-emerald-800 ring-emerald-200",
};

const LABELS: Record<PostStatus, string> = {
  draft: "Draft",
  published: "Published",
};

export function StatusBadge({
  status,
  className,
}: {
  status: PostStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium text-xs ring-1 ring-inset",
        STYLES[status],
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-1.5 rounded-full",
          status === "published" ? "bg-emerald-500" : "bg-amber-500",
        )}
      />
      {LABELS[status]}
    </span>
  );
}
