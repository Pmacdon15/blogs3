import { describe, expect, it, vi } from "vitest";
import {
  absoluteUrl,
  blogPostingJsonLd,
  blogSitemapUrls,
  getSiteUrl,
  personJsonLd,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITEMAP_PAGE_SIZE,
  serializeJsonLd,
  sitemapChunkCount,
  websiteJsonLd,
} from "@/lib/seo";
import type { Post } from "@/lib/types";

const samplePost: Post = {
  id: "p1",
  authorId: "u1",
  slug: "hello-world",
  title: "Hello world",
  excerpt: "A first post.",
  coverImageUrl: "https://example.com/cover.png",
  blocks: [{ id: "b1", type: "text", text: "Body" }],
  tags: ["nextjs", "seo"],
  status: "published",
  publishedAt: "2026-11-19T10:00:00.000Z",
  createdAt: "2026-11-19T09:00:00.000Z",
  updatedAt: "2026-11-19T12:00:00.000Z",
};

describe("site URL resolution", () => {
  it("prefers NEXT_PUBLIC_SITE_URL and strips any path", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://blogs.example.com/some/path/");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "prod.vercel.app");
    expect(getSiteUrl().toString()).toBe("https://blogs.example.com/");
    expect(absoluteUrl("/blog/hello")).toBe(
      "https://blogs.example.com/blog/hello",
    );
    expect(absoluteUrl()).toBe("https://blogs.example.com/");
  });

  it("adds https:// when a configured host omits the scheme", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "  ");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "blogs.vercel.app");
    expect(getSiteUrl().toString()).toBe("https://blogs.vercel.app/");
  });

  it("falls back to VERCEL_URL and then localhost", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    vi.stubEnv("VERCEL_URL", "preview-123.vercel.app");
    expect(getSiteUrl().toString()).toBe("https://preview-123.vercel.app/");

    vi.stubEnv("VERCEL_URL", "");
    expect(getSiteUrl().toString()).toBe("http://localhost:3000/");
  });
});

describe("sitemap pagination helpers", () => {
  it("always produces at least one chunk and scales past 50,000 URLs", () => {
    expect(sitemapChunkCount(0)).toBe(1);
    expect(sitemapChunkCount(1)).toBe(1);
    expect(sitemapChunkCount(SITEMAP_PAGE_SIZE)).toBe(1);
    expect(sitemapChunkCount(SITEMAP_PAGE_SIZE + 1)).toBe(2);
    expect(sitemapChunkCount(120_000)).toBe(3);
  });

  it("builds absolute URLs for each blog sitemap chunk", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://blogs.example.com");
    expect(blogSitemapUrls(0)).toEqual([
      "https://blogs.example.com/blog/sitemap/0.xml",
    ]);
    expect(blogSitemapUrls(25, 10)).toEqual([
      "https://blogs.example.com/blog/sitemap/0.xml",
      "https://blogs.example.com/blog/sitemap/1.xml",
      "https://blogs.example.com/blog/sitemap/2.xml",
    ]);
  });
});

describe("JSON-LD builders", () => {
  it("builds WebSite schema", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://blogs.example.com");
    expect(websiteJsonLd()).toEqual({
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      url: "https://blogs.example.com/",
    });
  });

  it("builds Person schema for the author with their profiles", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://blogs.example.com");
    expect(personJsonLd()).toEqual({
      "@context": "https://schema.org",
      "@type": "Person",
      name: "Patrick MacDonald",
      url: "https://blogs.example.com/about",
      homeLocation: { "@type": "Place", name: "Calgary, Alberta" },
      sameAs: [
        "https://www.patmac.ca",
        "https://github.com/Pmacdon15",
        "https://www.linkedin.com/in/patrick-macdonald-231640285",
      ],
    });
  });

  it("builds BlogPosting schema with optional fields populated or omitted", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://blogs.example.com");
    expect(blogPostingJsonLd(samplePost)).toEqual({
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: "Hello world",
      description: "A first post.",
      url: "https://blogs.example.com/blog/hello-world",
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": "https://blogs.example.com/blog/hello-world",
      },
      datePublished: "2026-11-19T10:00:00.000Z",
      dateModified: "2026-11-19T12:00:00.000Z",
      image: ["https://example.com/cover.png"],
      keywords: "nextjs, seo",
      author: {
        "@type": "Person",
        name: "Patrick MacDonald",
        url: "https://blogs.example.com/about",
      },
      publisher: {
        "@type": "Organization",
        name: SITE_NAME,
        url: "https://blogs.example.com/",
      },
    });

    const minimal = blogPostingJsonLd({
      ...samplePost,
      excerpt: "",
      publishedAt: null,
      coverImageUrl: null,
      tags: [],
    });
    expect(minimal.description).toBeUndefined();
    expect(minimal.datePublished).toBeUndefined();
    expect(minimal.image).toBeUndefined();
    expect(minimal.keywords).toBeUndefined();
  });

  it("escapes `<` when serializing JSON-LD to prevent script breakout", () => {
    const serialized = serializeJsonLd({
      headline: "Safe </script><script>alert(1)</script>",
    });
    expect(serialized).not.toContain("<");
    expect(JSON.parse(serialized)).toEqual({
      headline: "Safe </script><script>alert(1)</script>",
    });
  });
});
