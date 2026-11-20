import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Block } from "@/lib/schemas";
import type { Post } from "@/lib/types";

const m = vi.hoisted(() => ({
  listPostsForAdmin: vi.fn(),
  getPostForEdit: vi.fn(),
  createPost: vi.fn(),
  updatePost: vi.fn(),
  setPostStatus: vi.fn(),
  deletePost: vi.fn(),
  uploadImage: vi.fn(),
  isAdmin: vi.fn(),
  revalidatePostCaches: vi.fn(),
  dbSearchPublishedPosts: vi.fn(),
}));

vi.mock("@/lib/dal/posts", () => ({
  listPostsForAdmin: m.listPostsForAdmin,
  getPostForEdit: m.getPostForEdit,
  createPost: m.createPost,
  updatePost: m.updatePost,
  setPostStatus: m.setPostStatus,
  deletePost: m.deletePost,
  uploadImage: m.uploadImage,
}));
vi.mock("@/lib/dal/auth", () => ({ isAdmin: m.isAdmin }));
vi.mock("@/lib/cache/revalidate", () => ({
  revalidatePostCaches: m.revalidatePostCaches,
}));
vi.mock("@/db/posts", () => ({
  dbSearchPublishedPosts: m.dbSearchPublishedPosts,
}));

import {
  addBlock,
  createPost,
  deletePost,
  getPost,
  isFetchableHost,
  listPosts,
  moveBlock,
  postLinks,
  publishPost,
  removeBlock,
  searchPublishedPosts,
  unpublishPost,
  updateBlock,
  updatePostTool,
  uploadImage,
  whoami,
} from "@/mcp/tools";

const ID = "6f1c1d3e-8a39-4b8e-9d0a-1f2e3d4c5b6a";
const OTHER_ID = "0b6e9a52-3c1f-4f7a-8e2d-9c8b7a6f5e4d";
const USER = "user_admin";

const BLOCKS: Block[] = [
  { id: "h1", type: "heading", text: "Intro" },
  { id: "t1", type: "text", text: "Hello\n\nWorld" },
  { id: "i1", type: "image", url: "https://img.example.com/a.png", alt: "A" },
  { id: "i2", type: "image", url: "https://img.example.com/b.png", alt: "" },
  { id: "c1", type: "code", language: "typescript", code: "a\nb" },
];

const makePost = (overrides: Partial<Post> = {}): Post => ({
  id: ID,
  authorId: USER,
  slug: "hello-world",
  title: "Hello, World",
  excerpt: "An intro",
  coverImageUrl: "https://img.example.com/cover.png",
  blocks: BLOCKS,
  tags: ["intro"],
  status: "draft",
  publishedAt: null,
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-02T00:00:00.000Z",
  ...overrides,
});

const summary = (overrides: Partial<Post> = {}) => {
  const { blocks: _b, authorId: _a, ...rest } = makePost(overrides);
  return rest;
};

const change = { id: ID, slugs: ["hello-world"] };
const saved = (post: Post) => ({ ok: true, data: { post, change } });
const denied = { ok: false, error: "You don't have permission to edit posts." };

beforeEach(() => {
  m.getPostForEdit.mockResolvedValue({ ok: true, data: makePost() });
  m.updatePost.mockImplementation(async (_u, _id, patch) =>
    saved(makePost(patch)),
  );
  m.isAdmin.mockResolvedValue(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** The patch the tool sent to the DAL's updatePost. */
const sentPatch = () => m.updatePost.mock.calls[0][2];

describe("whoami", () => {
  it("says whether the caller is an admin", async () => {
    const admin = await whoami(USER);
    expect(admin.data).toEqual({ userId: USER, isAdmin: true });
    expect(admin.summary).toMatch(/an admin/);
    expect(m.isAdmin).toHaveBeenCalledWith(USER);

    m.isAdmin.mockResolvedValueOnce(false);
    const reader = await whoami("user_x");
    expect(reader.data).toEqual({ userId: "user_x", isAdmin: false });
    expect(reader.summary).toMatch(/isn't an admin/);
  });
});

describe("list_posts", () => {
  const posts = [
    summary(),
    summary({ id: OTHER_ID, slug: "b", status: "published" }),
  ];

  it("lists every post for the caller, drafts included", async () => {
    m.listPostsForAdmin.mockResolvedValue({ ok: true, data: posts });
    const result = await listPosts(USER, {});
    expect(m.listPostsForAdmin).toHaveBeenCalledWith(USER);
    expect(result.isError).toBeUndefined();
    expect(result.data).toEqual({
      view: "posts",
      posts,
      count: 2,
      status: "all",
    });
    expect(result.summary).toContain("1 draft(s), 1 published");
    expect(result.summary).toContain(`id=${ID}`);
  });

  it("filters by status", async () => {
    m.listPostsForAdmin.mockResolvedValue({ ok: true, data: posts });
    const result = await listPosts(USER, { status: "published" });
    expect(result.data.posts).toEqual([posts[1]]);
    expect(result.data.status).toBe("published");
  });

  it("refuses non-admins", async () => {
    m.listPostsForAdmin.mockResolvedValue(denied);
    const result = await listPosts("user_x", {});
    expect(result.isError).toBe(true);
    expect(result.summary).toBe(denied.error);
  });

  it("rejects a bad status", async () => {
    await expect(listPosts(USER, { status: "archived" })).rejects.toThrow();
  });
});

describe("get_post", () => {
  it("gets a post by id with every block", async () => {
    const result = await getPost(USER, { id: ID });
    expect(m.getPostForEdit).toHaveBeenCalledWith(USER, ID);
    expect(result.data).toEqual({
      view: "post",
      post: makePost(),
      path: "/blog/hello-world",
      editPath: `/admin/posts/${ID}`,
    });
    expect(result.summary).toContain("0. [heading] id=h1: Intro");
    expect(result.summary).toContain(
      "2. [image] id=i1: https://img.example.com/a.png (A)",
    );
    expect(result.summary).toContain(
      "3. [image] id=i2: https://img.example.com/b.png\n",
    );
    expect(result.summary).toContain("4. [code] id=c1: typescript, 2 line(s)");
  });

  it("says when a post has no blocks", async () => {
    m.getPostForEdit.mockResolvedValue({
      ok: true,
      data: makePost({ blocks: [] }),
    });
    expect((await getPost(USER, { id: ID })).summary).toContain(
      "No blocks yet.",
    );
  });

  it("finds a post by slug", async () => {
    m.listPostsForAdmin.mockResolvedValue({ ok: true, data: [summary()] });
    await getPost(USER, { slug: "hello-world" });
    expect(m.getPostForEdit).toHaveBeenCalledWith(USER, ID);
  });

  it("says when no post has the slug", async () => {
    m.listPostsForAdmin.mockResolvedValue({ ok: true, data: [summary()] });
    const result = await getPost(USER, { slug: "nope" });
    expect(result).toMatchObject({ isError: true, summary: "Post not found." });
    expect(m.getPostForEdit).not.toHaveBeenCalled();
  });

  it("refuses non-admins, by slug or by id", async () => {
    m.listPostsForAdmin.mockResolvedValue(denied);
    expect((await getPost("user_x", { slug: "a" })).isError).toBe(true);
    m.getPostForEdit.mockResolvedValue(denied);
    expect((await getPost("user_x", { id: ID })).summary).toBe(denied.error);
  });

  it("needs an id or a slug", async () => {
    await expect(getPost(USER, {})).rejects.toThrow(/id or slug/);
    await expect(getPost(USER, { id: "nope" })).rejects.toThrow();
  });
});

describe("search_published_posts", () => {
  it("searches published posts for anyone signed in", async () => {
    const posts = [summary({ status: "published" })];
    m.dbSearchPublishedPosts.mockResolvedValue(posts);
    const result = await searchPublishedPosts("user_x", { query: " next " });
    expect(m.dbSearchPublishedPosts).toHaveBeenCalledWith("next", 10);
    expect(result.data).toEqual({
      view: "posts",
      posts,
      count: 1,
      query: "next",
    });
    expect(result.summary).toContain('match "next"');
    expect(m.isAdmin).not.toHaveBeenCalled();
  });

  it("lists the newest posts for an empty query", async () => {
    m.dbSearchPublishedPosts.mockResolvedValue([]);
    const result = await searchPublishedPosts(USER, { limit: 3 });
    expect(m.dbSearchPublishedPosts).toHaveBeenCalledWith("", 3);
    expect(result.summary).toContain("newest");
  });

  it("validates the query", async () => {
    await expect(
      searchPublishedPosts(USER, { query: "x".repeat(101) }),
    ).rejects.toThrow();
    await expect(searchPublishedPosts(USER, { limit: 0 })).rejects.toThrow();
  });
});

describe("create_post", () => {
  it("creates a draft with a slug from the title and block ids, then revalidates", async () => {
    m.createPost.mockImplementation(async (_u, input) =>
      saved(makePost(input)),
    );
    const result = await createPost(USER, {
      title: "Hello, World!",
      tags: ["Intro"],
      blocks: [
        { type: "heading", text: "Intro" },
        { id: "keep", type: "text", text: "Body" },
        { type: "code", code: "x" },
      ],
    });
    const [userId, input] = m.createPost.mock.calls[0];
    expect(userId).toBe(USER);
    expect(input).toMatchObject({
      title: "Hello, World!",
      slug: "hello-world",
      excerpt: "",
      coverImageUrl: null,
      tags: ["intro"],
    });
    expect(input.blocks[0].id).toMatch(/^[0-9a-f-]{36}$/);
    expect(input.blocks[1].id).toBe("keep");
    expect(input.blocks[2]).toMatchObject({ language: "plaintext" });
    expect(m.revalidatePostCaches).toHaveBeenCalledWith(change);
    expect(result.data.view).toBe("post");
    expect(result.summary).toMatch(/^Created a draft\./);
  });

  it("keeps a given slug", async () => {
    m.createPost.mockImplementation(async (_u, input) =>
      saved(makePost(input)),
    );
    await createPost(USER, { title: "T", slug: "custom" });
    expect(m.createPost.mock.calls[0][1].slug).toBe("custom");
  });

  it("passes the DAL's field errors on and doesn't revalidate", async () => {
    m.createPost.mockResolvedValue({
      ok: false,
      error: "Another post already uses that slug.",
      fieldErrors: { slug: ["Another post already uses that slug."] },
    });
    const result = await createPost(USER, { title: "T" });
    expect(result.isError).toBe(true);
    expect(result.summary).toBe(
      "Another post already uses that slug. (slug: Another post already uses that slug.)",
    );
    expect(result.data.fieldErrors).toEqual({
      slug: ["Another post already uses that slug."],
    });
    expect(m.revalidatePostCaches).not.toHaveBeenCalled();
  });

  it("refuses non-admins", async () => {
    m.createPost.mockResolvedValue(denied);
    const result = await createPost("user_x", { title: "T" });
    expect(result).toMatchObject({ isError: true, summary: denied.error });
    expect(m.revalidatePostCaches).not.toHaveBeenCalled();
  });

  it("validates with the shared schemas", async () => {
    await expect(createPost(USER, { title: "" })).rejects.toThrow(
      /Title is required/,
    );
    await expect(
      createPost(USER, {
        title: "T",
        blocks: [{ type: "image", url: "http://x.com/a.png" }],
      }),
    ).rejects.toThrow(/https/);
  });
});

describe("update_post", () => {
  it("sends every field, so untouched ones stay as they are", async () => {
    const result = await updatePostTool(USER, { id: ID, title: "New" });
    expect(m.updatePost).toHaveBeenCalledWith(USER, ID, {
      title: "New",
      slug: "hello-world",
      excerpt: "An intro",
      coverImageUrl: "https://img.example.com/cover.png",
      tags: ["intro"],
      blocks: BLOCKS,
    });
    expect(m.revalidatePostCaches).toHaveBeenCalledWith(change);
    expect(result.summary).toMatch(/^Saved\./);
  });

  it("replaces the blocks and can remove the cover", async () => {
    await updatePostTool(USER, {
      id: ID,
      coverImageUrl: null,
      excerpt: "",
      tags: [],
      slug: "new-slug",
      blocks: [{ type: "text", text: "Only" }],
    });
    const patch = sentPatch();
    expect(patch.coverImageUrl).toBeNull();
    expect(patch.excerpt).toBe("");
    expect(patch.tags).toEqual([]);
    expect(patch.slug).toBe("new-slug");
    expect(patch.blocks).toHaveLength(1);
    expect(patch.blocks[0]).toMatchObject({ type: "text", text: "Only" });
  });

  it("needs something to change", async () => {
    const result = await updatePostTool(USER, { id: ID });
    expect(result).toMatchObject({
      isError: true,
      summary: "Nothing to update.",
    });
    expect(m.getPostForEdit).not.toHaveBeenCalled();
  });

  it("refuses non-admins and unknown posts", async () => {
    m.getPostForEdit.mockResolvedValueOnce(denied);
    expect(
      (await updatePostTool("user_x", { id: ID, title: "X" })).isError,
    ).toBe(true);
    m.updatePost.mockResolvedValueOnce({ ok: false, error: "Post not found." });
    const result = await updatePostTool(USER, { id: ID, title: "X" });
    expect(result.summary).toBe("Post not found.");
    expect(m.revalidatePostCaches).not.toHaveBeenCalled();
  });

  it("validates the patch", async () => {
    await expect(
      updatePostTool(USER, { id: ID, slug: "Not A Slug" }),
    ).rejects.toThrow();
    await expect(
      updatePostTool(USER, { id: "x", title: "T" }),
    ).rejects.toThrow();
  });
});

describe("block tools", () => {
  it("add_block appends, or inserts at a position, with a fresh id", async () => {
    await addBlock(USER, {
      postId: ID,
      block: { type: "heading", text: "End" },
    });
    let blocks = sentPatch().blocks as Block[];
    expect(blocks).toHaveLength(6);
    expect(blocks[5]).toMatchObject({ type: "heading", text: "End" });
    expect(m.revalidatePostCaches).toHaveBeenCalledWith(change);

    m.updatePost.mockClear();
    const result = await addBlock(USER, {
      postId: ID,
      block: { id: "h1", type: "text", text: "Top" },
      position: 0,
    });
    blocks = sentPatch().blocks as Block[];
    expect(blocks[0]).toMatchObject({ type: "text", text: "Top" });
    // The id was taken, so it got a new one.
    expect(blocks[0].id).not.toBe("h1");
    expect(result.summary).toMatch(/^Added a text block\./);
  });

  it("update_block changes one block's fields", async () => {
    await updateBlock(USER, {
      postId: ID,
      blockId: "c1",
      changes: { code: "const x = 1;", language: "javascript" },
    });
    expect((sentPatch().blocks as Block[])[4]).toEqual({
      id: "c1",
      type: "code",
      language: "javascript",
      code: "const x = 1;",
    });
  });

  it("update_block can change a block's type", async () => {
    await updateBlock(USER, {
      postId: ID,
      blockId: "h1",
      changes: { type: "text" },
    });
    expect((sentPatch().blocks as Block[])[0]).toEqual({
      id: "h1",
      type: "text",
      text: "Intro",
    });
  });

  it("update_block rejects an invalid result or an unknown block", async () => {
    const invalid = await updateBlock(USER, {
      postId: ID,
      blockId: "i1",
      changes: { url: "http://insecure.example.com/a.png" },
    });
    expect(invalid).toMatchObject({
      isError: true,
      summary: "Image must be an https URL",
    });
    const missing = await updateBlock(USER, {
      postId: ID,
      blockId: "zz",
      changes: { text: "x" },
    });
    expect(missing.summary).toBe("No block with id zz in this post.");
    expect(m.updatePost).not.toHaveBeenCalled();
  });

  it("update_block needs a change", async () => {
    await expect(
      updateBlock(USER, { postId: ID, blockId: "h1", changes: {} }),
    ).rejects.toThrow(/Say what to change/);
  });

  it("remove_block removes one block", async () => {
    const result = await removeBlock(USER, { postId: ID, blockId: "t1" });
    expect((sentPatch().blocks as Block[]).map((b) => b.id)).toEqual([
      "h1",
      "i1",
      "i2",
      "c1",
    ]);
    expect(result.summary).toMatch(/^Removed the block\./);
    expect(
      (await removeBlock(USER, { postId: ID, blockId: "zz" })).isError,
    ).toBe(true);
  });

  it("move_block moves a block, clamping the position", async () => {
    await moveBlock(USER, { postId: ID, blockId: "h1", position: 2 });
    expect((sentPatch().blocks as Block[]).map((b) => b.id)).toEqual([
      "t1",
      "i1",
      "h1",
      "i2",
      "c1",
    ]);
    m.updatePost.mockClear();
    await moveBlock(USER, { postId: ID, blockId: "h1", position: 99 });
    expect((sentPatch().blocks as Block[]).at(-1)?.id).toBe("h1");
    expect(
      (await moveBlock(USER, { postId: ID, blockId: "zz", position: 0 }))
        .summary,
    ).toMatch(/No block/);
  });

  it("refuses non-admins before changing anything", async () => {
    m.getPostForEdit.mockResolvedValue(denied);
    const result = await removeBlock("user_x", { postId: ID, blockId: "t1" });
    expect(result).toMatchObject({ isError: true, summary: denied.error });
    expect(m.updatePost).not.toHaveBeenCalled();
    expect(m.revalidatePostCaches).not.toHaveBeenCalled();
  });

  it("validates block input", async () => {
    await expect(
      addBlock(USER, { postId: ID, block: { type: "video" } }),
    ).rejects.toThrow();
    await expect(
      moveBlock(USER, { postId: ID, blockId: "h1", position: -1 }),
    ).rejects.toThrow();
  });
});

describe("publish_post / unpublish_post", () => {
  it("publishes and revalidates", async () => {
    m.setPostStatus.mockResolvedValue(saved(makePost({ status: "published" })));
    const result = await publishPost(USER, { id: ID });
    expect(m.setPostStatus).toHaveBeenCalledWith(USER, ID, "published");
    expect(m.revalidatePostCaches).toHaveBeenCalledWith(change);
    expect(result.summary).toMatch(/live at \/blog\/hello-world/);
  });

  it("unpublishes and revalidates", async () => {
    m.setPostStatus.mockResolvedValue(saved(makePost()));
    const result = await unpublishPost(USER, { id: ID });
    expect(m.setPostStatus).toHaveBeenCalledWith(USER, ID, "draft");
    expect(m.revalidatePostCaches).toHaveBeenCalledWith(change);
    expect(result.summary).toMatch(/draft again/);
  });

  it("passes refusals on", async () => {
    m.setPostStatus.mockResolvedValue({
      ok: false,
      error: "Add some content before publishing.",
    });
    const result = await publishPost(USER, { id: ID });
    expect(result).toMatchObject({ isError: true });
    expect(m.revalidatePostCaches).not.toHaveBeenCalled();
    m.setPostStatus.mockResolvedValue(denied);
    expect((await unpublishPost("user_x", { id: ID })).summary).toBe(
      denied.error,
    );
    await expect(publishPost(USER, {})).rejects.toThrow();
  });
});

describe("delete_post", () => {
  it("deletes only with confirm: true, then revalidates", async () => {
    m.deletePost.mockResolvedValue(saved(makePost()));
    const result = await deletePost(USER, { id: ID, confirm: true });
    expect(m.deletePost).toHaveBeenCalledWith(USER, ID);
    expect(m.revalidatePostCaches).toHaveBeenCalledWith(change);
    expect(result.data).toEqual({
      deleted: { id: ID, slug: "hello-world", title: "Hello, World" },
    });
  });

  it("refuses without confirm", async () => {
    await expect(deletePost(USER, { id: ID })).rejects.toThrow();
    await expect(
      deletePost(USER, { id: ID, confirm: false }),
    ).rejects.toThrow();
    expect(m.deletePost).not.toHaveBeenCalled();
  });

  it("passes refusals on", async () => {
    m.deletePost.mockResolvedValue(denied);
    const result = await deletePost("user_x", { id: ID, confirm: true });
    expect(result.isError).toBe(true);
    expect(m.revalidatePostCaches).not.toHaveBeenCalled();
  });
});

describe("upload_image", () => {
  const PNG = Buffer.from("fake png bytes").toString("base64");
  const BLOB_URL = "https://abc.public.blob.vercel-storage.com/posts/a.png";

  beforeEach(() => {
    m.uploadImage.mockResolvedValue({ ok: true, data: { url: BLOB_URL } });
  });

  const uploaded = () =>
    m.uploadImage.mock.calls[0][1] as {
      name: string;
      type: string;
      size: number;
      body: Blob;
    };

  it("stores a data: URL and returns the blob URL for an image block", async () => {
    const result = await uploadImage(USER, {
      data: `data:image/png;base64,${PNG}`,
    });
    const file = uploaded();
    expect(m.uploadImage.mock.calls[0][0]).toBe(USER);
    expect(file).toMatchObject({ name: "image.png", type: "image/png" });
    expect(file.size).toBe(14);
    expect(await file.body.text()).toBe("fake png bytes");
    expect(result.data).toEqual({
      url: BLOB_URL,
      block: { type: "image", url: BLOB_URL, alt: "" },
    });
    expect(result.summary).toContain(BLOB_URL);
  });

  it("stores plain base64 with a content type and filename", async () => {
    await uploadImage(USER, {
      data: `${PNG.slice(0, 8)}\n${PNG.slice(8)}`,
      contentType: "image/webp",
      filename: "photo.webp",
    });
    expect(uploaded()).toMatchObject({
      name: "photo.webp",
      type: "image/webp",
    });
  });

  it("needs a content type for plain base64, and valid base64", async () => {
    expect((await uploadImage(USER, { data: PNG })).summary).toMatch(
      /contentType/,
    );
    expect(
      (await uploadImage(USER, { data: "data:image/png;base64,***" })).summary,
    ).toMatch(/valid base64/);
    expect(m.uploadImage).not.toHaveBeenCalled();
  });

  it("rejects data over 4 MB before decoding", async () => {
    const result = await uploadImage(USER, {
      data: "A".repeat(6 * 1024 * 1024),
      contentType: "image/png",
    });
    expect(result.summary).toBe("Images must be under 4 MB.");
  });

  it("downloads an https URL", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response("gif bytes", {
          headers: { "content-type": "image/GIF; charset=binary" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await uploadImage(USER, { url: "https://img.example.com/cats/cat.gif" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      URL,
      RequestInit,
    ];
    expect(String(url)).toBe("https://img.example.com/cats/cat.gif");
    expect(init.redirect).toBe("error");
    expect(uploaded()).toMatchObject({
      name: "cat.gif",
      type: "image/gif",
      size: 9,
    });
  });

  it("names a download by filename or falls back to image", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Uint8Array([1]))),
    );
    await uploadImage(USER, {
      url: "https://img.example.com/a.png",
      filename: "mine.png",
    });
    expect(uploaded().name).toBe("mine.png");
    expect(uploaded().type).toBe("");
    m.uploadImage.mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null)),
    );
    await uploadImage(USER, { url: "https://img.example.com/" });
    expect(uploaded().name).toBe("image");
    expect(uploaded().size).toBe(0);
  });

  it("reports download failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("redirect");
      }),
    );
    expect(
      (await uploadImage(USER, { url: "https://img.example.com/a.png" }))
        .summary,
    ).toMatch(/Redirects aren't followed/);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 404 })),
    );
    expect(
      (await uploadImage(USER, { url: "https://img.example.com/a.png" }))
        .summary,
    ).toMatch(/HTTP 404/);

    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("x", { headers: { "content-length": "99999999" } }),
      ),
    );
    expect(
      (await uploadImage(USER, { url: "https://img.example.com/a.png" }))
        .summary,
    ).toBe("Images must be under 4 MB.");

    let cancelled = false;
    const oversizedStream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array(3 * 1024 * 1024));
      },
      cancel() {
        cancelled = true;
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(oversizedStream, {
            headers: { "content-type": "image/png" },
          }),
      ),
    );
    expect(
      (await uploadImage(USER, { url: "https://img.example.com/a.png" }))
        .summary,
    ).toBe("Images must be under 4 MB.");
    expect(cancelled).toBe(true);
    expect(m.uploadImage).not.toHaveBeenCalled();
  });

  it("never fetches internal hosts", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    for (const url of [
      "https://localhost/a.png",
      "https://localhost./a.png",
      "https://127.0.0.1/a.png",
      "https://127.0.0.1./a.png",
      "https://127.1/a.png",
      "https://0x7f.0x1/a.png",
      "https://[::1]/a.png",
      "https://db.internal/a.png",
      "https://127.0.0.1.nip.io/a.png",
      "https://localtest.me/a.png",
    ]) {
      expect((await uploadImage(USER, { url })).summary).toMatch(
        /can't be reached/,
      );
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("only lets admins upload, before downloading anything", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    m.isAdmin.mockResolvedValue(false);
    const result = await uploadImage("user_x", {
      url: "https://img.example.com/a.png",
    });
    expect(result).toMatchObject({
      isError: true,
      summary: "You don't have permission to edit posts.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("passes the DAL's type and size checks on", async () => {
    m.uploadImage.mockResolvedValue({
      ok: false,
      error: "Upload a PNG, JPEG, WebP, GIF or AVIF image.",
    });
    const result = await uploadImage(USER, {
      data: `data:image/svg+xml;base64,${PNG}`,
    });
    expect(result.summary).toMatch(/Upload a PNG/);
  });

  it("needs exactly one of url or data", async () => {
    await expect(uploadImage(USER, {})).rejects.toThrow(/either url or data/);
    await expect(
      uploadImage(USER, { url: "https://a.example.com/a.png", data: PNG }),
    ).rejects.toThrow();
    await expect(
      uploadImage(USER, { url: "http://a.example.com/a.png" }),
    ).rejects.toThrow(/https/);
  });
});

describe("helpers", () => {
  it("knows which hosts may be fetched", () => {
    expect(isFetchableHost("images.example.com")).toBe(true);
    expect(isFetchableHost("images.example.com.")).toBe(true);
    expect(isFetchableHost("intranet")).toBe(false);
    expect(isFetchableHost("printer.local")).toBe(false);
    expect(isFetchableHost("printer.local.")).toBe(false);
    expect(isFetchableHost("printer.home.arpa")).toBe(false);
    expect(isFetchableHost("10.0.0.1")).toBe(false);
    expect(isFetchableHost("10.0.0.1.")).toBe(false);
    expect(isFetchableHost("127.1")).toBe(false);
    expect(isFetchableHost("0177.0.0.01")).toBe(false);
    expect(isFetchableHost("127.0.0.0x1")).toBe(false);
    expect(isFetchableHost("0x7f000001")).toBe(false);
    expect(isFetchableHost("127.0.0.1.nip.io")).toBe(false);
    expect(isFetchableHost("127-0-0-1.sslip.io")).toBe(false);
    expect(isFetchableHost("127.0.0.1.xip.io")).toBe(false);
    expect(isFetchableHost("sub.localtest.me")).toBe(false);
    expect(isFetchableHost("localtest.me")).toBe(false);
    expect(isFetchableHost("foo.invalid")).toBe(false);
    expect(isFetchableHost("foo.test")).toBe(false);
    expect(isFetchableHost("foo.example")).toBe(false);
  });

  it("links a post to its public page and editor", () => {
    expect(postLinks({ id: ID, slug: "a" })).toEqual({
      path: "/blog/a",
      editPath: `/admin/posts/${ID}`,
    });
  });
});
