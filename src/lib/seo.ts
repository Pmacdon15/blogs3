import type { MetadataRoute } from "next";
import type { Post } from "@/lib/types";

export const SITE_NAME = "Blogs3";
export const SITE_DESCRIPTION = "Notes, guides and ideas.";
export const SITE_TAGLINE =
  "Practical write-ups on building for the web: what worked, what didn't, and the code to prove it.";
export const SITE_THEME_COLOR = "#2563eb";
export const SITE_BACKGROUND_COLOR = "#f8faff";

/** Google's protocol limit per sitemap file. */
export const SITEMAP_PAGE_SIZE = 50_000;

export type StaticSitemapRoute = {
  path: string;
  changeFrequency: NonNullable<
    MetadataRoute.Sitemap[number]["changeFrequency"]
  >;
  priority: number;
};

/**
 * Indexable top-level public routes. Add new static pages here (e.g. /about)
 * so they appear in /sitemap.xml automatically.
 */
export const PUBLIC_STATIC_ROUTES: readonly StaticSitemapRoute[] = [
  { path: "/", changeFrequency: "daily", priority: 1 },
];

const LOCAL_FALLBACK_URL = "http://localhost:3000";

function normalizeOrigin(raw: string): URL {
  const trimmed = raw.trim();
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  return new URL(new URL(withScheme).origin);
}

/**
 * Canonical site origin, resolved from environment variables without reading
 * request headers so Cache Components static shells stay intact.
 */
export function getSiteUrl(): URL {
  const candidate =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ||
    process.env.VERCEL_URL?.trim();
  return candidate ? normalizeOrigin(candidate) : new URL(LOCAL_FALLBACK_URL);
}

/** Absolute URL for a site-relative path (e.g. `/blog/hello`). */
export function absoluteUrl(path = "/"): string {
  return new URL(path, getSiteUrl()).toString();
}

/** Number of sitemap chunks needed for `totalItems` (always at least 1). */
export function sitemapChunkCount(
  totalItems: number,
  pageSize = SITEMAP_PAGE_SIZE,
): number {
  return Math.max(1, Math.ceil(totalItems / pageSize));
}

/** Absolute URLs for every paginated blog sitemap (`/blog/sitemap/[id].xml`). */
export function blogSitemapUrls(
  totalPosts: number,
  pageSize = SITEMAP_PAGE_SIZE,
): string[] {
  return Array.from(
    { length: sitemapChunkCount(totalPosts, pageSize) },
    (_, id) => absoluteUrl(`/blog/sitemap/${id}.xml`),
  );
}

/** JSON-LD WebSite structured data for the home page. */
export function websiteJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: absoluteUrl("/"),
  };
}

/** JSON-LD BlogPosting structured data for a published post page. */
export function blogPostingJsonLd(post: Post): Record<string, unknown> {
  const url = absoluteUrl(`/blog/${post.slug}`);
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt || undefined,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    datePublished: post.publishedAt ?? undefined,
    dateModified: post.updatedAt,
    image: post.coverImageUrl ? [post.coverImageUrl] : undefined,
    keywords: post.tags.length > 0 ? post.tags.join(", ") : undefined,
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: absoluteUrl("/"),
    },
  };
}

/** Escapes `<` so JSON-LD can never break out of its `<script>` tag. */
export function serializeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
