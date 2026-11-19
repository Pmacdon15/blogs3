import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CoverImage } from "@/components/blog/cover-image";
import { PostBlocks } from "@/components/blog/post-blocks";
import { PostMeta } from "@/components/blog/post-meta";
import { TagList } from "@/components/blog/tag-list";
import { ArticleSkeleton } from "@/components/ui/skeleton";
import { dbGetPublishedPostBySlug } from "@/db/posts";
import { CACHE_TAGS } from "@/lib/cache/tags";
import { readingMinutes } from "@/lib/reading-time";
import type { Post } from "@/lib/types";

type Props = { params: Promise<{ slug: string }> };

/** One published post, cached per slug; cleared when it or any list changes. */
async function getPublishedPost(slug: string) {
  "use cache";
  cacheLife("days");
  cacheTag(CACHE_TAGS.postSlug(slug), CACHE_TAGS.publishedPosts);
  return dbGetPublishedPostBySlug(slug);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  if (!post) return { title: "Post not found" };
  const description = post.excerpt || undefined;
  return {
    title: post.title,
    description,
    openGraph: {
      type: "article",
      title: post.title,
      description,
      publishedTime: post.publishedAt ?? undefined,
      tags: post.tags,
      images: post.coverImageUrl ? [post.coverImageUrl] : undefined,
    },
  };
}

/* The back link and article frame are the static shell; the post streams in. */
export default function PostPage({ params }: Props) {
  return (
    <div className="container-page max-w-3xl pt-10 sm:pt-14">
      <Link
        className="group inline-flex items-center gap-1.5 rounded-lg font-medium text-brand-700 text-sm hover:text-brand-800"
        href="/"
      >
        <ArrowLeft
          aria-hidden="true"
          className="size-4 transition group-hover:-translate-x-0.5"
        />
        All posts
      </Link>
      <article className="mt-8">
        <Suspense fallback={<ArticleSkeleton />}>
          <PostArticle slug={params.then((p) => p.slug)} />
        </Suspense>
      </article>
    </div>
  );
}

async function PostArticle({ slug }: { slug: Promise<string> }) {
  const post = await getPublishedPost(await slug);
  if (!post) notFound();
  return <PostBody post={post} />;
}

function PostBody({ post }: { post: Post }) {
  return (
    <>
      <header className="flex flex-col gap-5">
        <TagList tags={post.tags} />
        <h1 className="text-balance font-semibold text-3xl text-ink tracking-tight sm:text-4xl lg:text-5xl">
          {post.title}
        </h1>
        {post.excerpt ? (
          <p className="text-lg text-muted leading-relaxed sm:text-xl">
            {post.excerpt}
          </p>
        ) : null}
        <PostMeta
          minutes={readingMinutes(post.blocks)}
          publishedAt={post.publishedAt}
        />
      </header>
      {post.coverImageUrl ? (
        <CoverImage
          alt=""
          className="mt-10 aspect-[2/1] rounded-3xl border border-line shadow-(--shadow-card)"
          preload
          sizes="(min-width: 768px) 768px, 100vw"
          url={post.coverImageUrl}
        />
      ) : null}
      <div className="mt-10">
        <PostBlocks blocks={post.blocks} />
      </div>
    </>
  );
}
