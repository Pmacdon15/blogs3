import { beforeEach, describe, expect, it, vi } from "vitest";
import { SITEMAP_PAGE_SIZE } from "@/lib/seo";

const mocks = vi.hoisted(() => ({
  dbCountPublishedPosts: vi.fn(),
  dbListPublishedPostsForSitemap: vi.fn(),
  dbLatestPublishedPostUpdatedAt: vi.fn(),
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));

vi.mock("@/db/posts", () => ({
  dbCountPublishedPosts: mocks.dbCountPublishedPosts,
  dbListPublishedPostsForSitemap: mocks.dbListPublishedPostsForSitemap,
  dbLatestPublishedPostUpdatedAt: mocks.dbLatestPublishedPostUpdatedAt,
}));
vi.mock("next/cache", () => ({
  cacheLife: mocks.cacheLife,
  cacheTag: mocks.cacheTag,
}));

import blogSitemap, { generateSitemaps } from "@/app/(public)/blog/sitemap";
import robots from "@/app/robots";
import rootSitemap from "@/app/sitemap";

describe("SEO metadata routes", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://blogs3.example.com");
    mocks.dbCountPublishedPosts.mockResolvedValue(2);
    mocks.dbLatestPublishedPostUpdatedAt.mockResolvedValue(
      "2026-11-19T12:00:00.000Z",
    );
    mocks.dbListPublishedPostsForSitemap.mockResolvedValue([
      {
        slug: "first-post",
        updatedAt: "2026-11-19T12:00:00.000Z",
        coverImageUrl: "https://example.com/cover.png",
      },
      {
        slug: "second-post",
        updatedAt: "2026-11-18T10:00:00.000Z",
        coverImageUrl: null,
      },
    ]);
  });

  describe("root sitemap (/sitemap.xml)", () => {
    it("lists static public routes with the latest published post timestamp", async () => {
      const entries = await rootSitemap();
      expect(mocks.cacheLife).toHaveBeenCalledWith("hours");
      expect(mocks.cacheTag).toHaveBeenCalledWith("posts:published");
      expect(entries).toEqual([
        {
          url: "https://blogs3.example.com/",
          lastModified: "2026-11-19T12:00:00.000Z",
          changeFrequency: "daily",
          priority: 1,
        },
      ]);
    });

    it("omits lastModified when no posts are published yet", async () => {
      mocks.dbLatestPublishedPostUpdatedAt.mockResolvedValue(null);
      const entries = await rootSitemap();
      expect(entries[0]?.lastModified).toBeUndefined();
    });
  });

  describe("blog sitemap (/blog/sitemap/[id].xml)", () => {
    it("generates one chunk per 50,000 published posts", async () => {
      mocks.dbCountPublishedPosts.mockResolvedValue(0);
      await expect(generateSitemaps()).resolves.toEqual([{ id: 0 }]);

      mocks.dbCountPublishedPosts.mockResolvedValue(SITEMAP_PAGE_SIZE + 1);
      await expect(generateSitemaps()).resolves.toEqual([{ id: 0 }, { id: 1 }]);
      expect(mocks.cacheLife).toHaveBeenCalledWith("hours");
      expect(mocks.cacheTag).toHaveBeenCalledWith("posts:published");
    });

    it("maps each published post in the requested chunk with optional cover image", async () => {
      const entries = await blogSitemap({ id: Promise.resolve("1") });
      expect(mocks.dbListPublishedPostsForSitemap).toHaveBeenCalledWith(
        SITEMAP_PAGE_SIZE,
        SITEMAP_PAGE_SIZE,
      );
      expect(mocks.cacheLife).toHaveBeenCalledWith("hours");
      expect(mocks.cacheTag).toHaveBeenCalledWith("posts:published");
      expect(entries).toEqual([
        {
          url: "https://blogs3.example.com/blog/first-post",
          lastModified: "2026-11-19T12:00:00.000Z",
          changeFrequency: "weekly",
          priority: 0.8,
          images: ["https://example.com/cover.png"],
        },
        {
          url: "https://blogs3.example.com/blog/second-post",
          lastModified: "2026-11-18T10:00:00.000Z",
          changeFrequency: "weekly",
          priority: 0.8,
          images: undefined,
        },
      ]);
    });

    it("returns an empty sitemap for invalid or negative chunk ids", async () => {
      await expect(blogSitemap({ id: Promise.resolve("-1") })).resolves.toEqual(
        [],
      );
      await expect(
        blogSitemap({ id: Promise.resolve("abc") }),
      ).resolves.toEqual([]);
      expect(mocks.dbListPublishedPostsForSitemap).not.toHaveBeenCalled();
    });
  });

  describe("robots (/robots.txt)", () => {
    it("disallows private routes and advertises all sitemap URLs as the blog grows", async () => {
      mocks.dbCountPublishedPosts.mockResolvedValue(SITEMAP_PAGE_SIZE + 5);
      const result = await robots();
      expect(mocks.cacheLife).toHaveBeenCalledWith("hours");
      expect(mocks.cacheTag).toHaveBeenCalledWith("posts:published");
      expect(result).toEqual({
        rules: {
          userAgent: "*",
          allow: "/",
          disallow: ["/admin", "/api/", "/sign-in", "/sign-up", "/shell-check"],
        },
        sitemap: [
          "https://blogs3.example.com/sitemap.xml",
          "https://blogs3.example.com/blog/sitemap/0.xml",
          "https://blogs3.example.com/blog/sitemap/1.xml",
        ],
        host: "https://blogs3.example.com",
      });
    });
  });
});
