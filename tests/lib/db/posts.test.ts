import { beforeEach, describe, expect, it, vi } from "vitest";

type SqlCall = { text: string; values: unknown[] };

const mocks = vi.hoisted(() => {
  const calls: SqlCall[] = [];
  const state = { rows: [] as unknown[] };
  // Stands in for the `sql` tagged template neon() returns.
  const query = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
    calls.push({ text: strings.join("?").replace(/\s+/g, " ").trim(), values });
    return Promise.resolve(state.rows);
  });
  return {
    calls,
    state,
    query,
    sql: vi.fn(() => query),
    cacheLife: vi.fn(),
    cacheTag: vi.fn(),
  };
});

vi.mock("@/db/client", () => ({ sql: mocks.sql }));
vi.mock("next/cache", () => ({
  cacheLife: mocks.cacheLife,
  cacheTag: mocks.cacheTag,
}));

import {
  dbCountPublishedPosts,
  dbCreatePost,
  dbDeletePost,
  dbFindPostIdBySlug,
  dbGetPostById,
  dbGetPublishedPostBySlug,
  dbLatestPublishedPostUpdatedAt,
  dbListAllPosts,
  dbListPublishedPosts,
  dbListPublishedPostsForSitemap,
  dbSearchPublishedPosts,
  dbSetPostStatus,
  dbUpdatePost,
  toPost,
  toSummary,
} from "@/db/posts";
import type { Post } from "@/lib/types";

const row = {
  id: "p1",
  author_id: "user_1",
  slug: "hello",
  title: "Hello",
  excerpt: "Hi",
  cover_image_url: null,
  blocks: [{ id: "b1", type: "text" as const, text: "Body" }],
  tags: ["js"],
  status: "published" as const,
  published_at: new Date("2026-01-02T03:04:05Z"),
  created_at: "2026-01-01T00:00:00Z",
  updated_at: new Date("2026-01-03T00:00:00Z"),
};

const post: Post = {
  id: "p1",
  authorId: "user_1",
  slug: "hello",
  title: "Hello",
  excerpt: "Hi",
  coverImageUrl: null,
  blocks: [{ id: "b1", type: "text", text: "Body" }],
  tags: ["js"],
  status: "published",
  publishedAt: "2026-01-02T03:04:05.000Z",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-03T00:00:00.000Z",
};

const { blocks: _blocks, authorId: _authorId, ...summary } = post;

const lastCall = () => mocks.calls[mocks.calls.length - 1];

beforeEach(() => {
  mocks.calls.length = 0;
  mocks.state.rows = [row];
});

describe("row mapping", () => {
  it("turns a row into a post with ISO dates", () => {
    expect(toPost(row)).toEqual(post);
  });

  it("keeps an unpublished post's date null", () => {
    expect(toPost({ ...row, published_at: null }).publishedAt).toBeNull();
  });

  it("drops the blocks and author from a summary", () => {
    expect(toSummary(row)).toEqual(summary);
  });
});

describe("public reads", () => {
  it("lists published posts, newest first, without caching here", async () => {
    await expect(dbListPublishedPosts()).resolves.toEqual([summary]);
    expect(lastCall().text).toBe(
      "select * from posts where status = 'published' order by published_at desc limit ?",
    );
    expect(lastCall().values).toEqual([50]);
    await dbListPublishedPosts(5);
    expect(lastCall().values).toEqual([5]);
    expect(mocks.cacheTag).not.toHaveBeenCalled();
  });

  it("finds a published post by slug", async () => {
    await expect(dbGetPublishedPostBySlug("hello")).resolves.toEqual(post);
    expect(lastCall()).toEqual({
      text: "select * from posts where slug = ? and status = 'published' limit 1",
      values: ["hello"],
    });
    mocks.state.rows = [];
    await expect(dbGetPublishedPostBySlug("nope")).resolves.toBeNull();
  });

  it("searches titles, excerpts and tags with LIKE wildcards escaped", async () => {
    await expect(dbSearchPublishedPosts("50%_off\\")).resolves.toEqual([
      summary,
    ]);
    const { text, values } = lastCall();
    expect(text).toContain("title ilike ?");
    expect(text).toContain("or excerpt ilike ?");
    expect(text).toContain("unnest(tags) t where t ilike ?");
    expect(values).toEqual([
      "%50\\%\\_off\\\\%",
      "%50\\%\\_off\\\\%",
      "%50\\%\\_off\\\\%",
      10,
    ]);
    await dbSearchPublishedPosts("x", 3);
    expect(lastCall().values.at(-1)).toBe(3);
  });

  it("counts published posts for sitemap pagination", async () => {
    mocks.state.rows = [{ count: 42 }];
    await expect(dbCountPublishedPosts()).resolves.toBe(42);
    expect(lastCall().text).toBe(
      "select count(*)::int as count from posts where status = 'published'",
    );
    mocks.state.rows = [];
    await expect(dbCountPublishedPosts()).resolves.toBe(0);
  });

  it("lists paginated sitemap rows with slug, updatedAt and coverImageUrl", async () => {
    mocks.state.rows = [
      {
        slug: "hello",
        updated_at: new Date("2026-01-03T00:00:00Z"),
        cover_image_url: "https://example.com/cover.png",
      },
    ];
    await expect(dbListPublishedPostsForSitemap(100)).resolves.toEqual([
      {
        slug: "hello",
        updatedAt: "2026-01-03T00:00:00.000Z",
        coverImageUrl: "https://example.com/cover.png",
      },
    ]);
    expect(lastCall().values).toEqual([100, 0]);

    await dbListPublishedPostsForSitemap(50, 150);
    expect(lastCall().values).toEqual([50, 150]);
  });

  it("reads the latest published post updated_at timestamp", async () => {
    mocks.state.rows = [{ updated_at: new Date("2026-01-03T00:00:00Z") }];
    await expect(dbLatestPublishedPostUpdatedAt()).resolves.toBe(
      "2026-01-03T00:00:00.000Z",
    );
    mocks.state.rows = [{ updated_at: null }];
    await expect(dbLatestPublishedPostUpdatedAt()).resolves.toBeNull();
    mocks.state.rows = [];
    await expect(dbLatestPublishedPostUpdatedAt()).resolves.toBeNull();
  });
});

describe("private reads", () => {
  it("lists every post, cached under the admin tag", async () => {
    await expect(dbListAllPosts()).resolves.toEqual([summary]);
    expect(lastCall().text).toBe(
      "select * from posts order by updated_at desc",
    );
    expect(mocks.cacheLife).toHaveBeenCalledWith("hours");
    expect(mocks.cacheTag).toHaveBeenCalledWith("posts:admin");
  });

  it("reads one post by id, cached under its own tag", async () => {
    await expect(dbGetPostById("p1")).resolves.toEqual(post);
    expect(lastCall()).toEqual({
      text: "select * from posts where id = ? limit 1",
      values: ["p1"],
    });
    expect(mocks.cacheLife).toHaveBeenCalledWith("hours");
    expect(mocks.cacheTag).toHaveBeenCalledWith("post:p1");
    mocks.state.rows = [];
    await expect(dbGetPostById("p2")).resolves.toBeNull();
  });

  it("finds which post owns a slug", async () => {
    mocks.state.rows = [{ id: "p1" }];
    await expect(dbFindPostIdBySlug("hello")).resolves.toBe("p1");
    expect(lastCall()).toEqual({
      text: "select id from posts where slug = ? limit 1",
      values: ["hello"],
    });
    mocks.state.rows = [];
    await expect(dbFindPostIdBySlug("free")).resolves.toBeNull();
  });
});

describe("mutations", () => {
  const input = {
    title: "Hello",
    slug: "hello",
    excerpt: "Hi",
    coverImageUrl: null,
    tags: ["js"],
    blocks: post.blocks,
  };

  it("inserts a post with its blocks as jsonb", async () => {
    await expect(dbCreatePost("user_1", input)).resolves.toEqual(post);
    const { text, values } = lastCall();
    expect(text).toContain(
      "insert into posts (author_id, slug, title, excerpt, cover_image_url, blocks, tags)",
    );
    expect(text).toContain("?::jsonb");
    expect(text).toContain("returning *");
    expect(values).toEqual([
      "user_1",
      "hello",
      "Hello",
      "Hi",
      null,
      JSON.stringify(post.blocks),
      ["js"],
    ]);
  });

  const updateValues = () => lastCall().values;

  it("keeps every field a patch leaves out", async () => {
    const current = { ...post, coverImageUrl: "https://x.test/c.png" };
    await expect(dbUpdatePost(current, { title: "New" })).resolves.toEqual(
      post,
    );
    const { text } = lastCall();
    expect(text).toContain("update posts set slug = ?, title = ?");
    expect(text).toContain("updated_at = now() where id = ? returning *");
    expect(updateValues()).toEqual([
      "hello",
      "New",
      "Hi",
      "https://x.test/c.png",
      JSON.stringify(post.blocks),
      ["js"],
      "p1",
    ]);
  });

  it("keeps a field whose key is present but undefined", async () => {
    const current = { ...post, coverImageUrl: "https://x.test/c.png" };
    await dbUpdatePost(current, {
      slug: undefined,
      title: undefined,
      excerpt: undefined,
      coverImageUrl: undefined,
      blocks: undefined,
      tags: undefined,
    });
    expect(updateValues()).toEqual([
      "hello",
      "Hello",
      "Hi",
      "https://x.test/c.png",
      JSON.stringify(post.blocks),
      ["js"],
      "p1",
    ]);
  });

  it("writes every field a patch sets", async () => {
    const blocks = [{ id: "b2", type: "heading" as const, text: "H" }];
    await dbUpdatePost(post, {
      slug: "new-slug",
      title: "New",
      excerpt: "",
      coverImageUrl: "https://x.test/new.png",
      blocks,
      tags: [],
    });
    expect(updateValues()).toEqual([
      "new-slug",
      "New",
      "",
      "https://x.test/new.png",
      JSON.stringify(blocks),
      [],
      "p1",
    ]);
  });

  it("removes the cover on an explicit null", async () => {
    const current = { ...post, coverImageUrl: "https://x.test/c.png" };
    await dbUpdatePost(current, { coverImageUrl: null });
    expect(updateValues()[3]).toBeNull();
  });

  it("publishes (keeping the first publish date) or unpublishes", async () => {
    await expect(dbSetPostStatus("p1", "published")).resolves.toEqual(post);
    const { text, values } = lastCall();
    expect(text).toContain(
      "when ? = 'published' then coalesce(published_at, now()) else null",
    );
    expect(values).toEqual(["published", "published", "p1"]);
    mocks.state.rows = [];
    await expect(dbSetPostStatus("p2", "draft")).resolves.toBeNull();
  });

  it("deletes a post and returns what was deleted", async () => {
    await expect(dbDeletePost("p1")).resolves.toEqual(post);
    expect(lastCall()).toEqual({
      text: "delete from posts where id = ? returning *",
      values: ["p1"],
    });
    mocks.state.rows = [];
    await expect(dbDeletePost("p2")).resolves.toBeNull();
  });
});
