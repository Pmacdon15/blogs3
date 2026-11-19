import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchPostSearch,
  searchResponseSchema,
  usePostSearch,
} from "@/hooks/use-post-search";
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

function mockFetch(body: unknown, init: ResponseInit = {}) {
  const fetchMock = vi.fn(async () => Response.json(body, init));
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

describe("searchResponseSchema", () => {
  it("accepts results and rejects malformed ones", () => {
    expect(searchResponseSchema.parse({ results: [summary] })).toEqual({
      results: [summary],
    });
    expect(
      searchResponseSchema.safeParse({ results: [{ id: 1 }] }).success,
    ).toBe(false);
  });
});

describe("fetchPostSearch", () => {
  it("calls the search API with an encoded query", async () => {
    const fetchMock = mockFetch({ results: [summary] });
    await expect(fetchPostSearch("a&b c")).resolves.toEqual([summary]);
    expect(fetchMock).toHaveBeenCalledWith("/api/posts/search?q=a%26b%20c", {
      signal: undefined,
    });
  });

  it("throws on an error response", async () => {
    mockFetch({ error: "nope" }, { status: 400 });
    await expect(fetchPostSearch("ab")).rejects.toThrow("Search failed (400)");
  });

  it("throws when the response doesn't match the schema", async () => {
    mockFetch({ results: "nope" });
    await expect(fetchPostSearch("ab")).rejects.toThrow();
  });
});

describe("usePostSearch", () => {
  it("stays idle for queries under two characters", () => {
    const fetchMock = mockFetch({ results: [] });
    const { result } = renderHook(() => usePostSearch(" a "), {
      wrapper: wrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches and keeps the previous results while the next query loads", async () => {
    const fetchMock = mockFetch({ results: [summary] });
    const { result, rerender } = renderHook(({ q }) => usePostSearch(q), {
      initialProps: { q: "he" },
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.data).toEqual([summary]));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/posts/search?q=he",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );

    fetchMock.mockImplementation(() => new Promise(() => {}));
    rerender({ q: "hel" });
    expect(result.current.isPlaceholderData).toBe(true);
    expect(result.current.data).toEqual([summary]);
  });
});
