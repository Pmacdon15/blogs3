import type { MetadataRoute } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { dbCountPublishedPosts } from "@/db/posts";
import { CACHE_TAGS } from "@/lib/cache/tags";
import { absoluteUrl, blogSitemapUrls, getSiteUrl } from "@/lib/seo";

async function getPublishedPostCount() {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.publishedPosts);
  return dbCountPublishedPosts();
}

/** Crawl rules and sitemap index pointers (`/robots.txt`), updated as post chunks grow. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const totalPosts = await getPublishedPostCount();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api/", "/sign-in", "/sign-up", "/shell-check"],
    },
    sitemap: [absoluteUrl("/sitemap.xml"), ...blogSitemapUrls(totalPosts)],
    host: getSiteUrl().origin,
  };
}
