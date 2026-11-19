import { cacheLife, cacheTag } from "next/cache";
import { Suspense } from "react";
import { PostList } from "@/components/blog/post-list";
import { SearchBar } from "@/components/blog/search-bar";
import { PostGridSkeleton } from "@/components/ui/skeleton";
import { dbListPublishedPosts } from "@/db/posts";
import { CACHE_TAGS } from "@/lib/cache/tags";

/* Reads no URL or session: the whole page, posts included, builds static (○). */
export default function HomePage() {
  return (
    <>
      <section className="border-line border-b">
        <div className="container-page flex flex-col gap-6 pt-12 pb-10 sm:pt-16 sm:pb-12">
          <div className="flex flex-col gap-3">
            <h1 className="max-w-2xl text-balance font-semibold text-3xl text-ink tracking-tight sm:text-5xl">
              Notes, guides and ideas, written to be useful.
            </h1>
            <p className="max-w-xl text-base text-muted leading-relaxed sm:text-lg">
              Practical write-ups on building for the web: what worked, what
              didn&apos;t, and the code to prove it.
            </p>
          </div>
          <div className="w-full max-w-md">
            <SearchBar />
          </div>
        </div>
      </section>

      <section
        aria-labelledby="latest-heading"
        className="container-page flex flex-col gap-8 pt-10 sm:pt-12"
      >
        <div className="flex items-end justify-between gap-4">
          <h2
            className="font-semibold text-2xl text-ink tracking-tight sm:text-3xl"
            id="latest-heading"
          >
            Latest posts
          </h2>
        </div>
        <Suspense fallback={<PostGridSkeleton />}>
          <LatestPosts />
        </Suspense>
      </section>
    </>
  );
}

async function LatestPosts() {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.publishedPosts);
  const posts = await dbListPublishedPosts();
  return <PostList posts={posts} />;
}
