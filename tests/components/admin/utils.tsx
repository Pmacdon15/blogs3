import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import type { Post, PostSummary } from "@/lib/types";

export function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

export function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    authorId: "user_1",
    slug: "hello-world",
    title: "Hello world",
    excerpt: "An intro",
    coverImageUrl: null,
    blocks: [{ id: "b1", type: "text", text: "Body" }],
    tags: ["intro"],
    status: "draft",
    publishedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-02-03T00:00:00.000Z",
    ...overrides,
  };
}

export function makeSummary(overrides: Partial<PostSummary> = {}): PostSummary {
  const { blocks: _blocks, authorId: _authorId, ...summary } = makePost();
  return { ...summary, ...overrides };
}
