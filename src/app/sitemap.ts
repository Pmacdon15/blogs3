import type { MetadataRoute } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { dbLatestPublishedPostUpdatedAt } from "@/db/posts";
import { CACHE_TAGS } from "@/lib/cache/tags";
import { absoluteUrl, PUBLIC_STATIC_ROUTES } from "@/lib/seo";

async function getLatestPublishedUpdatedAt() {
  "use cache";
  cacheLife("hours");
  cacheTag(CACHE_TAGS.publishedPosts);
  return dbLatestPublishedPostUpdatedAt();
}

/** Top-level sitemap (`/sitemap.xml`) for static public routes. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const latestUpdatedAt = await getLatestPublishedUpdatedAt();
  return PUBLIC_STATIC_ROUTES.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified: latestUpdatedAt ?? undefined,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
