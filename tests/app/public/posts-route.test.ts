import { describe, expect, it, vi } from "vitest";
import { makeSummary } from "./fixtures";

const mocks = vi.hoisted(() => ({
  dbListPublishedPosts: vi.fn(),
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));

vi.mock("@/db/posts", () => ({
  dbListPublishedPosts: mocks.dbListPublishedPosts,
  PAGE_SIZE: 12,
}));
vi.mock("next/cache", () => ({
  cacheLife: mocks.cacheLife,
  cacheTag: mocks.cacheTag,
}));

import { GET } from "@/app/api/posts/route";

const get = (query: string) =>
  GET(new Request(`http://localhost/api/posts${query}`));

const cursor = {
  before: "2026-11-19T10:00:00.000Z",
  beforeId: "00000000-0000-4000-8000-000000000000",
};

describe("GET /api/posts", () => {
  it("returns the cached page after the cursor", async () => {
    const page = { posts: [makeSummary()], nextCursor: null };
    mocks.dbListPublishedPosts.mockResolvedValue(page);
    const response = await get(`?${new URLSearchParams(cursor)}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(page);
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=300");
    expect(mocks.dbListPublishedPosts).toHaveBeenCalledWith(12, cursor);
    expect(mocks.cacheLife).toHaveBeenCalledWith("minutes");
    expect(mocks.cacheTag).toHaveBeenCalledWith("posts:published");
  });

  it.each([
    "",
    `?before=${cursor.before}`,
    `?before=yesterday&beforeId=${cursor.beforeId}`,
    `?before=${cursor.before}&beforeId=p1`,
  ])("rejects a missing or malformed cursor (%s)", async (query) => {
    const response = await get(query);
    expect(response.status).toBe(400);
    expect(mocks.dbListPublishedPosts).not.toHaveBeenCalled();
  });
});
