import { cn } from "@/lib/cn";

/** Stable keys for a fixed number of placeholders. */
function placeholderKeys(count: number, prefix: string) {
  return Array.from({ length: count }, (_, i) => `${prefix}-${i}`);
}

/*
 * Fallbacks for Suspense holes. Each is sized like what it replaces; labels
 * and headings stay outside them, in the static shell.
 */

export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "block animate-shimmer rounded-md bg-brand-100/70",
        className,
      )}
    />
  );
}

export function TextSkeleton({ className }: { className?: string }) {
  return (
    <Skeleton
      className={cn("inline-block h-[1em] w-32 align-middle", className)}
    />
  );
}

export function PostCardSkeleton() {
  return (
    <div aria-hidden="true" className="card flex flex-col gap-3 p-5">
      <Skeleton className="aspect-[16/9] w-full rounded-xl" />
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-6 w-4/5" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

export function PostGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {placeholderKeys(count, "card").map((key) => (
        <PostCardSkeleton key={key} />
      ))}
    </div>
  );
}

export function ArticleSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4">
      <Skeleton className="h-10 w-3/4" />
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-6 aspect-[2/1] w-full rounded-2xl" />
      {placeholderKeys(5, "line").map((key) => (
        <Skeleton className="h-4 w-full" key={key} />
      ))}
    </div>
  );
}

export function TableRowsSkeleton({
  rows = 5,
  cols = 4,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <>
      {placeholderKeys(rows, "row").map((rowKey) => (
        <tr key={rowKey}>
          {placeholderKeys(cols, rowKey).map((cellKey) => (
            <td className="px-4 py-3" key={cellKey}>
              <Skeleton className="h-4 w-full" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
