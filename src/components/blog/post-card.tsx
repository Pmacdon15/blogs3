import { ArrowUpRight } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { CoverImage } from "@/components/blog/cover-image";
import { PostMeta } from "@/components/blog/post-meta";
import { TagList } from "@/components/blog/tag-list";
import { cn } from "@/lib/cn";
import type { PostSummary } from "@/lib/types";

export function postHref(slug: string) {
  return `/blog/${slug}` as Route;
}

/*
 * A post in a list. The whole card is one link (the title's ::after covers
 * the card), so tags and meta stay plain text for screen readers. The focus
 * ring goes on the card too, since the link covers all of it.
 */
export function PostCard({
  post,
  featured = false,
}: {
  post: PostSummary;
  featured?: boolean;
}) {
  return (
    <article
      className={cn(
        "card group relative flex flex-col overflow-hidden transition duration-200 hover:-translate-y-1 hover:border-brand-200 hover:shadow-(--shadow-lift) focus-within:-translate-y-1 focus-within:shadow-(--shadow-lift) has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-brand-600 has-[a:focus-visible]:outline-offset-2",
        featured && "md:grid md:grid-cols-2",
      )}
    >
      <CoverImage
        alt=""
        className={cn("aspect-[16/9]", featured && "md:aspect-auto md:h-full")}
        preload={featured}
        sizes={
          featured
            ? "(min-width: 768px) 560px, 100vw"
            : "(min-width: 1024px) 360px, (min-width: 640px) 50vw, 100vw"
        }
        url={post.coverImageUrl}
      />
      <div
        className={cn(
          "flex flex-1 flex-col gap-3 p-5 sm:p-6",
          featured && "md:justify-center md:gap-4 md:p-10",
        )}
      >
        {featured ? (
          <span className="w-fit rounded-full bg-brand-600 px-2.5 py-0.5 font-semibold text-white text-xs uppercase tracking-wide">
            Featured
          </span>
        ) : null}
        <PostMeta publishedAt={post.publishedAt} />
        <h3
          className={cn(
            "font-semibold text-ink tracking-tight",
            featured ? "text-2xl sm:text-3xl" : "text-xl",
          )}
        >
          <Link
            className="rounded-sm after:absolute after:inset-0 after:content-[''] focus-visible:outline-none group-hover:text-brand-700"
            href={postHref(post.slug)}
          >
            {post.title}
          </Link>
        </h3>
        {post.excerpt ? (
          <p
            className={cn(
              "text-muted leading-relaxed",
              featured ? "text-base sm:text-lg" : "line-clamp-3 text-sm",
            )}
          >
            {post.excerpt}
          </p>
        ) : null}
        <div className="mt-auto flex items-end justify-between gap-4 pt-2">
          <TagList tags={post.tags} />
          <ArrowUpRight
            aria-hidden="true"
            className="size-5 shrink-0 text-brand-400 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand-600"
          />
        </div>
      </div>
    </article>
  );
}
