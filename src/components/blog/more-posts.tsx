"use client";

import { LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PostCard } from "@/components/blog/post-card";
import { Button } from "@/components/ui/button";
import { PostGridSkeleton } from "@/components/ui/skeleton";
import { usePostPages } from "@/hooks/use-post-pages";
import type { PostCursor } from "@/lib/schemas";

/** Start loading this far before the end of the list scrolls into view. */
const PRELOAD_MARGIN = "600px";

/** A ref to observe, and whether that element is near the viewport. */
export function useNearViewport<T extends Element>() {
  const ref = useRef<T>(null);
  const [isNear, setIsNear] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const latest = entries.at(-1);
        if (latest) setIsNear(latest.isIntersecting);
      },
      { rootMargin: PRELOAD_MARGIN },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, isNear] as const;
}

/*
 * Infinite scroll below the server-rendered first page. The next page loads as
 * the end of the list nears the viewport, and keeps loading while it stays
 * near. The button does the same for keyboard users and browsers without
 * IntersectionObserver.
 */
export function MorePosts({ cursor }: { cursor: PostCursor }) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isError } =
    usePostPages(cursor);
  const posts = data.pages.flatMap((page) => page.posts);

  const [sentinel, isNear] = useNearViewport<HTMLDivElement>();

  // Keeps loading while the end stays near, e.g. on a screen taller than a page.
  useEffect(() => {
    if (isNear && hasNextPage && !isFetchingNextPage && !isError) {
      void fetchNextPage();
    }
  }, [isNear, hasNextPage, isFetchingNextPage, isError, fetchNextPage]);

  return (
    <div className="flex flex-col gap-6">
      {posts.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      ) : null}
      {isFetchingNextPage ? <PostGridSkeleton count={3} /> : null}
      <div
        className="flex flex-col items-center gap-3 py-4 text-center"
        ref={sentinel}
      >
        <p aria-live="polite" className="text-muted text-sm">
          {isError
            ? "Couldn’t load more posts."
            : hasNextPage
              ? null
              : "That’s every post."}
        </p>
        {hasNextPage ? (
          <Button
            disabled={isFetchingNextPage}
            onClick={() => void fetchNextPage()}
            variant="secondary"
          >
            {isFetchingNextPage ? (
              <LoaderCircle
                aria-hidden="true"
                className="size-4 animate-spin"
              />
            ) : null}
            {isError ? "Try again" : "Load more posts"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
