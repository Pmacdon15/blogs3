import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSummary } from "./fixtures";
import { pending, renderShell, renderToHtml } from "./render";

const mocks = vi.hoisted(() => ({
  dbListPublishedPosts: vi.fn(),
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));

vi.mock("@/db/posts", () => ({
  dbListPublishedPosts: mocks.dbListPublishedPosts,
}));
vi.mock("next/cache", () => ({
  cacheLife: mocks.cacheLife,
  cacheTag: mocks.cacheTag,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/hooks/use-post-search", () => ({
  MIN_SEARCH_LENGTH: 2,
  usePostSearch: () => ({ data: undefined, isError: false, isFetching: false }),
}));
vi.mock("@/hooks/use-post-pages", () => ({
  usePostPages: () => ({
    data: { pages: [{ posts: [], nextCursor: {} }] },
    hasNextPage: true,
    isFetchingNextPage: false,
    isError: false,
    fetchNextPage: vi.fn(),
  }),
}));

import HomePage, { metadata } from "@/app/(public)/page";

describe("home page", () => {
  beforeEach(() => {
    mocks.dbListPublishedPosts.mockResolvedValue({
      posts: [],
      nextCursor: null,
    });
  });

  it("exports canonical home page SEO metadata", () => {
    expect(metadata).toMatchObject({
      title: { absolute: "Blogs" },
      alternates: { canonical: "/" },
      openGraph: { type: "website", url: "/" },
      twitter: { card: "summary_large_image" },
    });
  });

  it("keeps the hero, JSON-LD, search and section heading in the static shell", async () => {
    mocks.dbListPublishedPosts.mockReturnValue(pending());
    const html = await renderShell(<HomePage />);
    expect(html).toContain('type="application/ld+json"');
    expect(html).toContain('"@type":"WebSite"');
    expect(html).toContain("<h1");
    expect(html).toContain("written to be useful");
    expect(html).not.toContain("Fresh writing, every week");
    expect(html).toContain("Latest posts");
    expect(html).toContain('role="combobox"');
  });

  it("caches the latest posts for hours under the published-posts tag", async () => {
    const posts = [
      makeSummary({ id: "a", slug: "first", title: "First post" }),
      makeSummary({ id: "b", slug: "second", title: "Second post" }),
    ];
    mocks.dbListPublishedPosts.mockResolvedValue({ posts, nextCursor: null });
    const html = await renderToHtml(<HomePage />);
    expect(mocks.cacheLife).toHaveBeenCalledWith("hours");
    expect(mocks.cacheTag).toHaveBeenCalledWith("posts:published");
    expect(html).toContain("First post");
    expect(html).toContain('href="/blog/second"');
    expect(html).toContain("Featured");
    expect(html).not.toContain("Load more posts");
  });

  it("offers more posts when another page follows", async () => {
    mocks.dbListPublishedPosts.mockResolvedValue({
      posts: [makeSummary()],
      nextCursor: {
        before: "2026-11-19T10:00:00.000Z",
        beforeId: "00000000-0000-4000-8000-000000000000",
      },
    });
    const html = await renderToHtml(<HomePage />);
    expect(html).toContain("Load more posts");
  });

  it("shows an empty state when nothing is published", async () => {
    const html = await renderToHtml(<HomePage />);
    expect(html).toContain("No posts yet");
  });
});
