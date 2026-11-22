import { beforeEach, describe, expect, it, vi } from "vitest";
import { makePost } from "./fixtures";
import { pending, renderShell, renderToHtml } from "./render";

const mocks = vi.hoisted(() => ({
  dbGetPublishedPostBySlug: vi.fn(),
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("@/db/posts", () => ({
  dbGetPublishedPostBySlug: mocks.dbGetPublishedPostBySlug,
}));
vi.mock("next/cache", () => ({
  cacheLife: mocks.cacheLife,
  cacheTag: mocks.cacheTag,
}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));

import PostPage, { generateMetadata } from "@/app/(public)/blog/[slug]/page";

const params = (slug: string) => Promise.resolve({ slug });

describe("post page", () => {
  beforeEach(() => {
    mocks.dbGetPublishedPostBySlug.mockResolvedValue(makePost());
  });

  it("keeps the back link and article frame in the shell without reading the post", async () => {
    const html = await renderShell(<PostPage params={pending()} />);
    expect(html).toContain("All posts");
    expect(html).toContain("<article");
    expect(mocks.dbGetPublishedPostBySlug).not.toHaveBeenCalled();
  });

  it("renders the post, cached for days under its slug and the list tag", async () => {
    mocks.dbGetPublishedPostBySlug.mockResolvedValue(
      makePost({
        title: "Deep dive",
        coverImageUrl: "https://example.com/cover.png",
        tags: ["nextjs"],
      }),
    );
    const html = await renderToHtml(<PostPage params={params("deep-dive")} />);
    expect(mocks.dbGetPublishedPostBySlug).toHaveBeenCalledWith("deep-dive");
    expect(mocks.cacheLife).toHaveBeenCalledWith("days");
    expect(mocks.cacheTag).toHaveBeenCalledWith(
      "post-slug:deep-dive",
      "posts:published",
    );
    expect(html).toMatch(/<h1[^>]*>Deep dive<\/h1>/);
    expect(html).toContain("1 min read");
    expect(html).toContain("Nov 19, 2026");
    expect(html).toContain("#nextjs");
    expect(html).toContain("cover.png");
    expect(html).toContain("Some words here.");
    expect(html).toContain('type="application/ld+json"');
    expect(html).toContain('"@type":"BlogPosting"');
    expect(html).toContain("Share this post");
    expect(html).toContain(
      encodeURIComponent("http://localhost:3000/blog/hello-world"),
    );
  });

  it("renders a post without excerpt or cover", async () => {
    mocks.dbGetPublishedPostBySlug.mockResolvedValue(
      makePost({ excerpt: "", coverImageUrl: null }),
    );
    const html = await renderToHtml(
      <PostPage params={params("hello-world")} />,
    );
    expect(html).not.toContain("<img");
    expect(html).toContain("Hello world");
  });

  it("shows when a published post was updated later", async () => {
    mocks.dbGetPublishedPostBySlug.mockResolvedValue(
      makePost({ updatedAt: "2026-11-21T08:00:00.000Z" }),
    );
    const html = await renderToHtml(
      <PostPage params={params("hello-world")} />,
    );
    expect(html).toContain("Updated on");
    expect(html).toContain("Nov 21, 2026");
  });

  it("calls notFound for a missing post", async () => {
    mocks.dbGetPublishedPostBySlug.mockResolvedValue(null);
    const errors: unknown[] = [];
    await renderToHtml(<PostPage params={params("nope")} />, (error) =>
      errors.push(error),
    );
    expect(mocks.notFound).toHaveBeenCalled();
    expect(errors).toEqual([new Error("NEXT_NOT_FOUND")]);
  });
});

describe("post metadata", () => {
  it("uses the post's title, excerpt, tags, canonical URL and cover", async () => {
    mocks.dbGetPublishedPostBySlug.mockResolvedValue(
      makePost({ coverImageUrl: "https://example.com/c.png" }),
    );
    const metadata = await generateMetadata({ params: params("hello-world") });
    expect(metadata).toEqual({
      title: "Hello world",
      description: "A first post.",
      keywords: ["intro"],
      alternates: { canonical: "/blog/hello-world" },
      openGraph: {
        type: "article",
        url: "/blog/hello-world",
        title: "Hello world",
        description: "A first post.",
        publishedTime: "2026-11-19T10:00:00.000Z",
        modifiedTime: "2026-11-19T10:00:00.000Z",
        tags: ["intro"],
        images: [{ url: "https://example.com/c.png", alt: "Hello world" }],
      },
      twitter: {
        card: "summary_large_image",
        title: "Hello world",
        description: "A first post.",
        images: ["https://example.com/c.png"],
      },
    });
  });

  it("leaves out an empty excerpt, empty tags, missing date and cover", async () => {
    mocks.dbGetPublishedPostBySlug.mockResolvedValue(
      makePost({ excerpt: "", publishedAt: null, tags: [] }),
    );
    const metadata = await generateMetadata({ params: params("hello-world") });
    expect(metadata.description).toBeUndefined();
    expect(metadata.keywords).toBeUndefined();
    expect(metadata.openGraph).toMatchObject({
      publishedTime: undefined,
      images: undefined,
    });
    expect(metadata.twitter).toMatchObject({
      card: "summary",
      images: undefined,
    });
  });

  it("titles a missing post and marks it noindex", async () => {
    mocks.dbGetPublishedPostBySlug.mockResolvedValue(null);
    expect(await generateMetadata({ params: params("nope") })).toEqual({
      title: "Post not found",
      robots: { index: false, follow: false },
    });
  });
});
