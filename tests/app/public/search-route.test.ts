import { describe, expect, it, vi } from "vitest";
import { makeSummary } from "./fixtures";

const mocks = vi.hoisted(() => ({
  dbSearchPublishedPosts: vi.fn(),
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));

vi.mock("@/db/posts", () => ({
  dbSearchPublishedPosts: mocks.dbSearchPublishedPosts,
}));
vi.mock("next/cache", () => ({
  cacheLife: mocks.cacheLife,
  cacheTag: mocks.cacheTag,
}));

import { GET, SEARCH_RATE_LIMIT } from "@/app/api/posts/search/route";

const get = (query: string) =>
  GET(new Request(`http://localhost/api/posts/search${query}`));

describe("GET /api/posts/search", () => {
  it("returns cached matches for the lower-cased query", async () => {
    const results = [makeSummary()];
    mocks.dbSearchPublishedPosts.mockResolvedValue(results);
    const response = await get("?q=%20Hello%20");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ results });
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=300");
    expect(mocks.dbSearchPublishedPosts).toHaveBeenCalledWith("hello");
    expect(mocks.cacheLife).toHaveBeenCalledWith("minutes");
    expect(mocks.cacheTag).toHaveBeenCalledWith("posts:published");
  });

  it.each(["", "?q=", "?q=a", "?q=%20a%20"])(
    "returns no results for a short query (%s)",
    async (query) => {
      const response = await get(query);
      expect(await response.json()).toEqual({ results: [] });
      expect(mocks.dbSearchPublishedPosts).not.toHaveBeenCalled();
    },
  );

  it("rejects a query over 100 characters", async () => {
    const response = await get(`?q=${"a".repeat(101)}`);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Search query must be at most 100 characters.",
    });
  });

  it("limits each client IP to 60 searches a minute", async () => {
    mocks.dbSearchPublishedPosts.mockResolvedValue([]);
    const from = (ip: string) =>
      GET(
        new Request("http://localhost/api/posts/search?q=hello", {
          headers: { "x-real-ip": ip },
        }),
      );
    for (let i = 0; i < 60; i++) {
      expect((await from("9.9.9.9")).status).toBe(200);
    }
    const limited = await from("9.9.9.9");
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Cache-Control")).toBe("no-store");
    expect(Number(limited.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(await limited.json()).toEqual({
      error: "Too many searches. Try again in a minute.",
    });
    expect((await from("8.8.8.8")).status).toBe(200);
    expect(SEARCH_RATE_LIMIT.peek("9.9.9.9").allowed).toBe(false);
  });
});
