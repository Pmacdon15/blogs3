import type { MetadataRoute } from "next";
import { cacheLife, cacheTag } from "next/cache";
import {
  dbCountPublishedPosts,
  dbListPublishedPostsForSitemap,
} from "@/db/posts";
import { CACHE_TAGS } from "@/lib/cache/tags";
import { absoluteUrl, SITEMAP_PAGE_SIZE, sitemapChunkCount } from "@/lib/seo";

async function getPublishedPostCount() {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.publishedPosts);
  return dbCountPublishedPosts();
}

async function getSitemapPosts(page: number) {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.publishedPosts);
  return dbListPublishedPostsForSitemap(
    SITEMAP_PAGE_SIZE,
    page * SITEMAP_PAGE_SIZE,
  );
}

/** Splits published posts into 50,000-URL sitemap chunks (`/blog/sitemap/[id].xml`). */
export async function generateSitemaps() {
  const total = await getPublishedPostCount();
  return Array.from({ length: sitemapChunkCount(total) }, (_, id) => ({ id }));
}

export default async function sitemap({
  id,
}: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const page = Number(await id);
  if (!Number.isInteger(page) || page < 0) return [];
  const posts = await getSitemapPosts(page);
  return posts.map((post) => ({
    url: absoluteUrl(`/blog/${post.slug}`),
    lastModified: post.updatedAt,
    changeFrequency: "weekly",
    priority: 0.8,
    images: post.coverImageUrl ? [post.coverImageUrl] : undefined,
  }));
}
