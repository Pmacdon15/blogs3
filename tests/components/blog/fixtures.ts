import type { PostSummary } from "@/lib/types";

export function makeSummary(overrides: Partial<PostSummary> = {}): PostSummary {
  return {
    id: "1",
    slug: "hello-world",
    title: "Hello world",
    excerpt: "A first post.",
    coverImageUrl: null,
    tags: ["intro"],
    status: "published",
    publishedAt: "2026-11-19T10:00:00.000Z",
    createdAt: "2026-11-18T10:00:00.000Z",
    updatedAt: "2026-11-19T10:00:00.000Z",
    ...overrides,
  };
}
