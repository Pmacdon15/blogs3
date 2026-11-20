import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class NotAuthorizedError extends Error {}
  return {
    NotAuthorizedError,
    assertAdmin: vi.fn(),
    db: {
      dbCreatePost: vi.fn(),
      dbDeletePost: vi.fn(),
      dbFindPostIdBySlug: vi.fn(),
      dbGetPostById: vi.fn(),
      dbListAllPosts: vi.fn(),
      dbSetPostStatus: vi.fn(),
      dbUpdatePost: vi.fn(),
    },
    put: vi.fn(),
  };
});

vi.mock("@/db/posts", () => mocks.db);
vi.mock("@/lib/dal/auth", () => ({
  assertAdmin: mocks.assertAdmin,
  NotAuthorizedError: mocks.NotAuthorizedError,
}));
vi.mock("@vercel/blob", () => ({ put: mocks.put }));

import {
  createPost,
  deletePost,
  getPostForEdit,
  listPostsForAdmin,
  matchesImageSignature,
  setPostStatus,
  updatePost,
  uploadImage,
} from "@/lib/dal/posts";
import { postInputSchema } from "@/lib/schemas";
import type { Post } from "@/lib/types";

const ID = "6f1c2c1e-8d1b-4a59-9c3e-1d2b3c4d5e6f";
const OTHER_ID = "0b5e1a52-2a47-4a3c-9d34-6d1f8f2a4b10";

const post: Post = {
  id: ID,
  authorId: "user_1",
  slug: "hello",
  title: "Hello",
  excerpt: "",
  coverImageUrl: null,
  blocks: [{ id: "b1", type: "text", text: "Body" }],
  tags: [],
  status: "draft",
  publishedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const denied = { ok: false, error: "Not you." };
const broken = { ok: false, error: "Something went wrong. Please try again." };
const notFound = { ok: false, error: "Post not found." };
const slugTaken = {
  ok: false,
  error: "Another post already uses that slug.",
  fieldErrors: { slug: ["Another post already uses that slug."] },
};

beforeEach(() => {
  mocks.assertAdmin.mockImplementation(async (userId: string) => userId);
  mocks.db.dbGetPostById.mockResolvedValue(post);
  mocks.db.dbFindPostIdBySlug.mockResolvedValue(null);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

/** Every DAL function checks the admin first and turns errors into results. */
const calls = {
  listPostsForAdmin: () => listPostsForAdmin("user_1"),
  getPostForEdit: () => getPostForEdit("user_1", ID),
  createPost: () => createPost("user_1", { title: "Hello", slug: "hello" }),
  updatePost: () => updatePost("user_1", ID, { title: "New" }),
  setPostStatus: () => setPostStatus("user_1", ID, "published"),
  deletePost: () => deletePost("user_1", ID),
  uploadImage: () =>
    uploadImage("user_1", {
      name: "a.png",
      type: "image/png",
      size: 10,
      body: new Blob([PNG_BYTES]),
    }),
};

describe.each(Object.entries(calls))("%s", (_name, call) => {
  it("refuses non-admins with the auth error's message", async () => {
    mocks.assertAdmin.mockRejectedValue(
      new mocks.NotAuthorizedError("Not you."),
    );
    await expect(call()).resolves.toEqual(denied);
    for (const fn of Object.values(mocks.db)) expect(fn).not.toHaveBeenCalled();
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it("hides unexpected errors behind a generic message", async () => {
    const error = new Error("db down");
    mocks.assertAdmin.mockRejectedValue(error);
    await expect(call()).resolves.toEqual(broken);
    expect(console.error).toHaveBeenCalledWith("DAL: unexpected error", error);
  });
});

describe("listPostsForAdmin", () => {
  it("lists every post for an admin", async () => {
    mocks.db.dbListAllPosts.mockResolvedValue(["summary"]);
    await expect(listPostsForAdmin("user_1")).resolves.toEqual({
      ok: true,
      data: ["summary"],
    });
    expect(mocks.assertAdmin).toHaveBeenCalledWith("user_1");
  });
});

describe("getPostForEdit", () => {
  it("returns any post by id", async () => {
    await expect(getPostForEdit("user_1", ID)).resolves.toEqual({
      ok: true,
      data: post,
    });
    expect(mocks.db.dbGetPostById).toHaveBeenCalledWith(ID);
  });

  it("treats a bad or unknown id as not found", async () => {
    await expect(getPostForEdit("user_1", "nope")).resolves.toEqual(notFound);
    expect(mocks.db.dbGetPostById).not.toHaveBeenCalled();
    mocks.db.dbGetPostById.mockResolvedValue(null);
    await expect(getPostForEdit("user_1", ID)).resolves.toEqual(notFound);
  });
});

describe("createPost", () => {
  it("validates, then creates the post as the admin", async () => {
    mocks.db.dbCreatePost.mockResolvedValue(post);
    await expect(
      createPost("user_1", { title: " Hello ", slug: "hello" }),
    ).resolves.toEqual({
      ok: true,
      data: { post, change: { id: ID, slugs: ["hello"] } },
    });
    expect(mocks.db.dbFindPostIdBySlug).toHaveBeenCalledWith("hello");
    expect(mocks.db.dbCreatePost).toHaveBeenCalledWith("user_1", {
      title: "Hello",
      slug: "hello",
      excerpt: "",
      coverImageUrl: null,
      tags: [],
      blocks: [],
    });
  });

  it("returns field errors for invalid input", async () => {
    await expect(createPost("user_1", { slug: "Bad Slug" })).resolves.toEqual({
      ok: false,
      error: expect.any(String),
      fieldErrors: {
        title: [expect.any(String)],
        slug: ["Use lowercase letters, numbers and single dashes"],
      },
    });
    expect(mocks.db.dbCreatePost).not.toHaveBeenCalled();
  });

  it("puts errors on the whole input under _", async () => {
    await expect(createPost("user_1", "not an object")).resolves.toEqual({
      ok: false,
      error: expect.any(String),
      fieldErrors: { _: [expect.any(String)] },
    });
  });

  it("falls back to a generic message when zod gives no issues", async () => {
    vi.spyOn(postInputSchema, "safeParse").mockReturnValueOnce({
      success: false,
      error: { issues: [] },
    } as never);
    await expect(createPost("user_1", {})).resolves.toEqual({
      ok: false,
      error: "Invalid input",
      fieldErrors: {},
    });
  });

  it("refuses a slug another post uses", async () => {
    mocks.db.dbFindPostIdBySlug.mockResolvedValue(OTHER_ID);
    await expect(
      createPost("user_1", { title: "Hello", slug: "hello" }),
    ).resolves.toEqual(slugTaken);
  });
});

describe("updatePost", () => {
  it("saves the patch and reports the old and new slugs", async () => {
    const saved = { ...post, slug: "new-slug" };
    mocks.db.dbUpdatePost.mockResolvedValue(saved);
    await expect(
      updatePost("user_1", ID, { slug: "new-slug" }),
    ).resolves.toEqual({
      ok: true,
      data: { post: saved, change: { id: ID, slugs: ["hello", "new-slug"] } },
    });
    expect(mocks.db.dbFindPostIdBySlug).toHaveBeenCalledWith("new-slug");
    expect(mocks.db.dbUpdatePost).toHaveBeenCalledWith(
      post,
      expect.objectContaining({ slug: "new-slug" }),
    );
  });

  it("skips the slug check when the slug doesn't change", async () => {
    mocks.db.dbUpdatePost.mockResolvedValue(post);
    await updatePost("user_1", ID, { title: "New" });
    await updatePost("user_1", ID, { slug: "hello" });
    expect(mocks.db.dbFindPostIdBySlug).not.toHaveBeenCalled();
  });

  it("allows a slug the post itself owns", async () => {
    mocks.db.dbFindPostIdBySlug.mockResolvedValue(ID);
    mocks.db.dbGetPostById.mockResolvedValue({ ...post, slug: "old" });
    mocks.db.dbUpdatePost.mockResolvedValue(post);
    await expect(
      updatePost("user_1", ID, { slug: "hello" }),
    ).resolves.toMatchObject({ ok: true });
  });

  it("refuses a slug another post uses", async () => {
    mocks.db.dbFindPostIdBySlug.mockResolvedValue(OTHER_ID);
    await expect(updatePost("user_1", ID, { slug: "taken" })).resolves.toEqual(
      slugTaken,
    );
    expect(mocks.db.dbUpdatePost).not.toHaveBeenCalled();
  });

  it("returns not found for a bad or missing id", async () => {
    await expect(updatePost("user_1", "nope", {})).resolves.toEqual(notFound);
    mocks.db.dbGetPostById.mockResolvedValue(null);
    await expect(updatePost("user_1", ID, {})).resolves.toEqual(notFound);
  });

  it("returns field errors for an invalid patch", async () => {
    await expect(
      updatePost("user_1", ID, { title: "" }),
    ).resolves.toMatchObject({
      ok: false,
      error: "Title is required",
      fieldErrors: { title: ["Title is required"] },
    });
  });
});

describe("setPostStatus", () => {
  it("publishes a post with content", async () => {
    const published = { ...post, status: "published" as const };
    mocks.db.dbSetPostStatus.mockResolvedValue(published);
    await expect(setPostStatus("user_1", ID, "published")).resolves.toEqual({
      ok: true,
      data: { post: published, change: { id: ID, slugs: ["hello"] } },
    });
    expect(mocks.db.dbSetPostStatus).toHaveBeenCalledWith(ID, "published");
  });

  it("won't publish an empty post but will unpublish one", async () => {
    mocks.db.dbGetPostById.mockResolvedValue({ ...post, blocks: [] });
    await expect(setPostStatus("user_1", ID, "published")).resolves.toEqual({
      ok: false,
      error: "Add some content before publishing.",
    });
    mocks.db.dbSetPostStatus.mockResolvedValue(post);
    await expect(setPostStatus("user_1", ID, "draft")).resolves.toMatchObject({
      ok: true,
    });
  });

  it("returns not found for a bad, missing or vanished post", async () => {
    await expect(setPostStatus("user_1", "nope", "draft")).resolves.toEqual(
      notFound,
    );
    mocks.db.dbSetPostStatus.mockResolvedValue(null);
    await expect(setPostStatus("user_1", ID, "draft")).resolves.toEqual(
      notFound,
    );
    mocks.db.dbGetPostById.mockResolvedValue(null);
    await expect(setPostStatus("user_1", ID, "draft")).resolves.toEqual(
      notFound,
    );
  });
});

describe("deletePost", () => {
  it("deletes the post and reports its slug", async () => {
    mocks.db.dbDeletePost.mockResolvedValue(post);
    await expect(deletePost("user_1", ID)).resolves.toEqual({
      ok: true,
      data: { post, change: { id: ID, slugs: ["hello"] } },
    });
    expect(mocks.db.dbDeletePost).toHaveBeenCalledWith(ID);
  });

  it("returns not found for a bad or missing id", async () => {
    await expect(deletePost("user_1", "nope")).resolves.toEqual(notFound);
    mocks.db.dbDeletePost.mockResolvedValue(null);
    await expect(deletePost("user_1", ID)).resolves.toEqual(notFound);
  });
});

describe("matchesImageSignature", () => {
  it("recognizes valid magic bytes for PNG, JPEG, GIF, WebP and AVIF", () => {
    expect(matchesImageSignature("image/png", PNG_BYTES)).toBe(true);
    expect(
      matchesImageSignature("image/jpeg", new Uint8Array([0xff, 0xd8, 0xff])),
    ).toBe(true);
    expect(
      matchesImageSignature("image/gif", new TextEncoder().encode("GIF87a...")),
    ).toBe(true);
    expect(
      matchesImageSignature("image/gif", new TextEncoder().encode("GIF89a...")),
    ).toBe(true);
    expect(
      matchesImageSignature(
        "image/webp",
        new TextEncoder().encode("RIFF0000WEBP"),
      ),
    ).toBe(true);
    expect(
      matchesImageSignature(
        "image/avif",
        new TextEncoder().encode("0000ftypavif"),
      ),
    ).toBe(true);
    expect(
      matchesImageSignature(
        "image/avif",
        new TextEncoder().encode("0000ftypavis"),
      ),
    ).toBe(true);
    expect(
      matchesImageSignature(
        "image/avif",
        new TextEncoder().encode("0000ftypmif1"),
      ),
    ).toBe(true);
  });

  it("rejects mismatched, truncated or unknown types", () => {
    expect(matchesImageSignature("image/png", new Uint8Array([0x89]))).toBe(
      false,
    );
    expect(
      matchesImageSignature(
        "image/webp",
        new TextEncoder().encode("RIFF0000NOPE"),
      ),
    ).toBe(false);
    expect(
      matchesImageSignature(
        "image/avif",
        new TextEncoder().encode("0000ftypmp42"),
      ),
    ).toBe(false);
    expect(matchesImageSignature("text/html", PNG_BYTES)).toBe(false);
  });
});

describe("uploadImage", () => {
  const file = (
    overrides: Partial<Parameters<typeof uploadImage>[1]> = {},
  ) => ({
    name: "My Photo (1).PNG",
    type: "image/png",
    size: 1024,
    body: new Blob([PNG_BYTES]),
    ...overrides,
  });

  it("stores the image publicly under a safe name", async () => {
    mocks.put.mockResolvedValue({
      url: "https://x.public.blob.vercel-storage.com/a.png",
    });
    const image = file();
    await expect(uploadImage("user_1", image)).resolves.toEqual({
      ok: true,
      data: { url: "https://x.public.blob.vercel-storage.com/a.png" },
    });
    expect(mocks.put).toHaveBeenCalledWith(
      "posts/my-photo-1-.png",
      image.body,
      { access: "public", addRandomSuffix: true, contentType: "image/png" },
    );
  });

  it("names a file with no usable characters 'image' and keeps long names short", async () => {
    mocks.put.mockResolvedValue({ url: "u" });
    await uploadImage("user_1", file({ name: "" }));
    expect(mocks.put).toHaveBeenLastCalledWith(
      "posts/image",
      expect.anything(),
      expect.anything(),
    );
    await uploadImage(
      "user_1",
      file({ name: "photo", body: PNG_BYTES.buffer }),
    );
    expect(mocks.put.mock.lastCall?.[0]).toBe("posts/photo");
    await uploadImage("user_1", file({ name: `${"a".repeat(100)}.png` }));
    expect(mocks.put.mock.lastCall?.[0]).toBe(`posts/${"a".repeat(76)}.png`);
  });

  it("replaces dangerous or non-image extensions with the type's canonical extension", async () => {
    mocks.put.mockResolvedValue({ url: "u" });
    await uploadImage("user_1", file({ name: "exploit.html" }));
    expect(mocks.put.mock.lastCall?.[0]).toBe("posts/exploit.png");
    await uploadImage("user_1", file({ name: ".svg" }));
    expect(mocks.put.mock.lastCall?.[0]).toBe("posts/image.png");
  });

  it("only takes web image types and verifies magic bytes", async () => {
    await expect(
      uploadImage("user_1", file({ type: "application/pdf" })),
    ).resolves.toEqual({
      ok: false,
      error: "Upload a PNG, JPEG, WebP, GIF or AVIF image.",
    });
    await expect(
      uploadImage(
        "user_1",
        file({ body: new Blob(["<script>alert(1)</script>"]) }),
      ),
    ).resolves.toEqual({
      ok: false,
      error: "Upload a PNG, JPEG, WebP, GIF or AVIF image.",
    });
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it.each([0, 4 * 1024 * 1024 + 1])("refuses a %i byte file", async (size) => {
    await expect(uploadImage("user_1", file({ size }))).resolves.toEqual({
      ok: false,
      error: "Images must be under 4 MB.",
    });
    expect(mocks.put).not.toHaveBeenCalled();
  });
});
