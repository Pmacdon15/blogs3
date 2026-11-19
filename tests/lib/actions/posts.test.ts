import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  isAdmin: true,
  updateTag: vi.fn(),
  createPost: vi.fn(),
  updatePost: vi.fn(),
  setPostStatus: vi.fn(),
  deletePost: vi.fn(),
  uploadImage: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: mocks.auth,
  clerkClient: vi.fn(),
}));
vi.mock("next/cache", () => ({
  updateTag: mocks.updateTag,
  revalidateTag: vi.fn(),
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));
vi.mock("@/lib/dal/posts", () => ({
  createPost: mocks.createPost,
  updatePost: mocks.updatePost,
  setPostStatus: mocks.setPostStatus,
  deletePost: mocks.deletePost,
  uploadImage: mocks.uploadImage,
}));

import {
  createPostAction,
  deletePostAction,
  publishPostAction,
  unpublishPostAction,
  updatePostAction,
  uploadImageAction,
} from "@/lib/actions/posts";

const post = { id: "p1", slug: "hello", title: "Hello", status: "draft" };
const change = { id: "p1", slugs: ["old", "hello"] };
const ok = { ok: true, data: { post, change } };

beforeEach(() => {
  vi.stubEnv("ADMIN_USER_IDS", "user_1");
  mocks.auth.mockResolvedValue({ userId: "user_1" });
});

describe("post mutations", () => {
  it("creates as the admin and refreshes the post's caches", async () => {
    mocks.createPost.mockResolvedValue(ok);
    await expect(createPostAction({ title: "Hello" })).resolves.toEqual({
      ok: true,
      data: post,
    });
    expect(mocks.createPost).toHaveBeenCalledWith("user_1", { title: "Hello" });
    expect(mocks.updateTag.mock.calls.map(([tag]) => tag)).toEqual([
      "posts:published",
      "posts:admin",
      "post:p1",
      "post-slug:old",
      "post-slug:hello",
    ]);
  });

  it("updates, publishes and unpublishes through the DAL", async () => {
    mocks.updatePost.mockResolvedValue(ok);
    mocks.setPostStatus.mockResolvedValue(ok);
    await expect(updatePostAction("p1", { title: "x" })).resolves.toEqual({
      ok: true,
      data: post,
    });
    expect(mocks.updatePost).toHaveBeenCalledWith("user_1", "p1", {
      title: "x",
    });
    await publishPostAction("p1");
    expect(mocks.setPostStatus).toHaveBeenLastCalledWith(
      "user_1",
      "p1",
      "published",
    );
    await unpublishPostAction("p1");
    expect(mocks.setPostStatus).toHaveBeenLastCalledWith(
      "user_1",
      "p1",
      "draft",
    );
  });

  it("deletes and returns only the id", async () => {
    mocks.deletePost.mockResolvedValue(ok);
    await expect(deletePostAction("p1")).resolves.toEqual({
      ok: true,
      data: { id: "p1" },
    });
    expect(mocks.updateTag).toHaveBeenCalledWith("post:p1");
  });

  it("passes DAL failures through without touching the caches", async () => {
    const failure = {
      ok: false,
      error: "Title is required",
      fieldErrors: { title: ["Title is required"] },
    };
    mocks.createPost.mockResolvedValue(failure);
    await expect(createPostAction({})).resolves.toEqual(failure);
    expect(mocks.updateTag).not.toHaveBeenCalled();
  });

  it("refuses signed-out users and non-admins", async () => {
    mocks.auth.mockResolvedValue({ userId: null });
    await expect(createPostAction({})).resolves.toEqual({
      ok: false,
      error: "You don't have permission to edit posts.",
    });
    mocks.auth.mockResolvedValue({ userId: "user_2" });
    await expect(deletePostAction("p1")).resolves.toMatchObject({ ok: false });
    expect(mocks.createPost).not.toHaveBeenCalled();
    expect(mocks.deletePost).not.toHaveBeenCalled();
  });

  it("rethrows unexpected auth errors", async () => {
    mocks.auth.mockRejectedValue(new Error("clerk down"));
    await expect(publishPostAction("p1")).rejects.toThrow("clerk down");
  });
});

describe("uploadImageAction", () => {
  it("uploads the form's file as the admin", async () => {
    mocks.uploadImage.mockResolvedValue({
      ok: true,
      data: { url: "https://x/a.png" },
    });
    const file = new File(["png"], "a.png", { type: "image/png" });
    const form = new FormData();
    form.set("file", file);
    await expect(uploadImageAction(form)).resolves.toEqual({
      ok: true,
      data: { url: "https://x/a.png" },
    });
    expect(mocks.uploadImage).toHaveBeenCalledWith("user_1", {
      name: "a.png",
      type: "image/png",
      size: 3,
      body: expect.any(File),
    });
    expect(mocks.updateTag).not.toHaveBeenCalled();
  });

  it("asks for a file when there isn't one", async () => {
    const form = new FormData();
    form.set("file", "not a file");
    await expect(uploadImageAction(form)).resolves.toEqual({
      ok: false,
      error: "Choose an image to upload.",
    });
    await expect(
      uploadImageAction("junk" as unknown as FormData),
    ).resolves.toMatchObject({ ok: false });
    expect(mocks.uploadImage).not.toHaveBeenCalled();
  });

  it("refuses non-admins", async () => {
    mocks.auth.mockResolvedValue({ userId: null });
    await expect(uploadImageAction(new FormData())).resolves.toMatchObject({
      ok: false,
      error: "You don't have permission to edit posts.",
    });
  });
});
