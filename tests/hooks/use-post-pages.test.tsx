import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchPostPage,
  postPageSchema,
  usePostPages,
} from "@/hooks/use-post-pages";
import type { PostSummary } from "@/lib/types";

const summary: PostSummary = {
  id: "1",
  slug: "hello-world",
  title: "Hello world",
  excerpt: "",
  coverImageUrl: null,
  tags: [],
  status: "published",
  publishedAt: "2026-11-19T10:00:00.000Z",
  createdAt: "2026-11-19T10:00:00.000Z",
  updatedAt: "2026-11-19T10:00:00.000Z",
};

const cursor = {
  before: "2026-11-20T10:00:00.000Z",
  beforeId: "00000000-0000-4000-8000-000000000000",
};
const next = { ...cursor, before: "2026-11-19T10:00:00.000Z" };

function mockFetch(...bodies: { body: unknown; init?: ResponseInit }[]) {
  const fetchMock = vi.fn();
  for (const { body, init } of bodies) {
    fetchMock.mockImplementationOnce(async () => Response.json(body, init));
  }
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("postPageSchema", () => {
  it("accepts a page and rejects a malformed cursor", () => {
    const page = { posts: [summary], nextCursor: cursor };
    expect(postPageSchema.parse(page)).toEqual(page);
    expect(
      postPageSchema.safeParse({ posts: [], nextCursor: { before: "x" } })
        .success,
    ).toBe(false);
  });
});

describe("fetchPostPage", () => {
  it("calls the posts API with the cursor", async () => {
    const fetchMock = mockFetch({ body: { posts: [], nextCursor: null } });
    await expect(fetchPostPage(cursor)).resolves.toEqual({
      posts: [],
      nextCursor: null,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/posts?before=${encodeURIComponent(cursor.before)}&beforeId=${cursor.beforeId}`,
      { signal: undefined },
    );
  });

  it("throws on an error response", async () => {
    mockFetch({ body: { error: "bad" }, init: { status: 400 } });
    await expect(fetchPostPage(cursor)).rejects.toThrow(
      "Loading posts failed (400)",
    );
  });
});

describe("usePostPages", () => {
  it("loads nothing until asked, then follows each cursor to the end", async () => {
    const fetchMock = mockFetch(
      { body: { posts: [summary], nextCursor: next } },
      { body: { posts: [{ ...summary, id: "2" }], nextCursor: null } },
    );
    const { result } = renderHook(() => usePostPages(cursor), {
      wrapper: wrapper(),
    });
    expect(result.current.data.pages).toEqual([
      { posts: [], nextCursor: cursor },
    ]);
    expect(result.current.hasNextPage).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();

    await act(() => result.current.fetchNextPage());
    await act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.hasNextPage).toBe(false));
    expect(
      result.current.data.pages.flatMap((page) => page.posts.map((p) => p.id)),
    ).toEqual(["1", "2"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
