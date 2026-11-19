import { Sparkles } from "lucide-react";
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
      <section className="relative isolate overflow-hidden">
        <div aria-hidden="true" className="absolute inset-0 -z-10">
          <div className="absolute -top-32 left-1/2 h-[28rem] w-[56rem] -translate-x-1/2 rounded-full bg-linear-to-r from-brand-200/70 via-brand-100/60 to-sky-100/70 blur-3xl" />
          <div className="absolute top-24 -right-24 size-72 rounded-full bg-brand-400/20 blur-3xl" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-linear-to-b from-transparent to-canvas" />
        </div>
        <div className="container-page flex flex-col items-center gap-6 pt-16 pb-14 text-center sm:pt-24 sm:pb-20">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-white/70 px-3 py-1 font-medium text-brand-700 text-xs backdrop-blur">
            <Sparkles aria-hidden="true" className="size-3.5" />
            Fresh writing, every week
          </span>
          <h1 className="max-w-3xl text-balance font-semibold text-4xl text-ink tracking-tight sm:text-5xl lg:text-6xl">
            Notes, guides and ideas,{" "}
            <span className="bg-linear-to-r from-brand-500 to-brand-800 bg-clip-text text-transparent">
              written to be useful
            </span>
          </h1>
          <p className="max-w-xl text-balance text-lg text-muted leading-relaxed">
            Practical write-ups on building for the web: what worked, what
            didn&apos;t, and the code to prove it.
          </p>
          <div className="w-full max-w-xl pt-2">
            <SearchBar />
          </div>
        </div>
      </section>

      <section
        aria-labelledby="latest-heading"
        className="container-page flex flex-col gap-8"
      >
        <div className="flex items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2
              className="font-semibold text-2xl text-ink tracking-tight sm:text-3xl"
              id="latest-heading"
            >
              Latest posts
            </h2>
            <p className="text-muted">The newest writing, freshest first.</p>
          </div>
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
