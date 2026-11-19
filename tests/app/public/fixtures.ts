import type { Post, PostSummary } from "@/lib/types";

export function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    authorId: "user_1",
    slug: "hello-world",
    title: "Hello world",
    excerpt: "A first post.",
    coverImageUrl: null,
    blocks: [{ id: "b1", type: "text", text: "Some words here." }],
    tags: ["intro"],
    status: "published",
    publishedAt: "2026-11-19T10:00:00.000Z",
    createdAt: "2026-11-18T10:00:00.000Z",
    updatedAt: "2026-11-19T10:00:00.000Z",
    ...overrides,
  };
}

export function makeSummary(overrides: Partial<PostSummary> = {}): PostSummary {
  const { blocks: _blocks, authorId: _authorId, ...summary } = makePost();
  return { ...summary, ...overrides };
}
