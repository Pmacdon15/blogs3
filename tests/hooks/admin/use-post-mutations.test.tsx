import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  createPostAction: vi.fn(),
  updatePostAction: vi.fn(),
  publishPostAction: vi.fn(),
  unpublishPostAction: vi.fn(),
  deletePostAction: vi.fn(),
  uploadImageAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.success, error: mocks.error },
}));
vi.mock("@/lib/actions/posts", () => ({
  createPostAction: mocks.createPostAction,
  updatePostAction: mocks.updatePostAction,
  publishPostAction: mocks.publishPostAction,
  unpublishPostAction: mocks.unpublishPostAction,
  deletePostAction: mocks.deletePostAction,
  uploadImageAction: mocks.uploadImageAction,
}));

import {
  ActionError,
  fieldErrorsOf,
  unwrap,
  useCreatePost,
  useDeletePost,
  usePublishPost,
  useUnpublishPost,
  useUpdatePost,
  useUploadImage,
} from "@/hooks/admin/use-post-mutations";
import type { PostInput } from "@/lib/schemas";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const input = { title: "Hi", slug: "hi" } as PostInput;
const draft = { id: "p1", status: "draft" };
const published = { id: "p1", status: "published" };

beforeEach(() => {
  mocks.createPostAction.mockResolvedValue({ ok: true, data: draft });
  mocks.updatePostAction.mockResolvedValue({ ok: true, data: draft });
  mocks.publishPostAction.mockResolvedValue({ ok: true, data: published });
  mocks.unpublishPostAction.mockResolvedValue({ ok: true, data: draft });
  mocks.deletePostAction.mockResolvedValue({ ok: true, data: { id: "p1" } });
  mocks.uploadImageAction.mockResolvedValue({
    ok: true,
    data: { url: "https://img/a.png" },
  });
});

describe("helpers", () => {
  it("unwraps results and keeps field errors", () => {
    expect(unwrap({ ok: true, data: 1 })).toBe(1);
    try {
      unwrap({ ok: false, error: "Bad", fieldErrors: { slug: ["Taken"] } });
    } catch (error) {
      expect(error).toBeInstanceOf(ActionError);
      expect((error as Error).message).toBe("Bad");
      expect(fieldErrorsOf(error)).toEqual({ slug: ["Taken"] });
    }
    expect.assertions(5);
    expect(fieldErrorsOf(new Error("x"))).toBeUndefined();
  });
});

describe("useCreatePost", () => {
  it("saves a draft and opens its editor", async () => {
    const { result } = renderHook(useCreatePost, { wrapper });
    await act(() => result.current.mutateAsync({ input }));
    expect(mocks.createPostAction).toHaveBeenCalledWith(input);
    expect(mocks.publishPostAction).not.toHaveBeenCalled();
    expect(mocks.success).toHaveBeenCalledWith("Draft saved");
    expect(mocks.push).toHaveBeenCalledWith("/admin/posts/p1");
  });

  it("can publish right after creating", async () => {
    const { result } = renderHook(useCreatePost, { wrapper });
    await act(() => result.current.mutateAsync({ input, publish: true }));
    expect(mocks.publishPostAction).toHaveBeenCalledWith("p1");
    expect(mocks.success).toHaveBeenCalledWith("Post published");
  });

  it("toasts failures", async () => {
    mocks.createPostAction.mockResolvedValue({ ok: false, error: "Nope" });
    const { result } = renderHook(useCreatePost, { wrapper });
    act(() => result.current.mutate({ input }));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mocks.error).toHaveBeenCalledWith("Nope");
    expect(mocks.push).not.toHaveBeenCalled();
  });
});

describe("edit mutations", () => {
  it("updates and refreshes", async () => {
    const { result } = renderHook(useUpdatePost, { wrapper });
    await act(() => result.current.mutateAsync({ id: "p1", patch: input }));
    expect(mocks.updatePostAction).toHaveBeenCalledWith("p1", input);
    expect(mocks.success).toHaveBeenCalledWith("Changes saved");
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("publishes, saving pending changes first", async () => {
    const { result } = renderHook(usePublishPost, { wrapper });
    await act(() => result.current.mutateAsync({ id: "p1" }));
    expect(mocks.updatePostAction).not.toHaveBeenCalled();
    await act(() => result.current.mutateAsync({ id: "p1", patch: input }));
    expect(mocks.updatePostAction).toHaveBeenCalledWith("p1", input);
    expect(mocks.publishPostAction).toHaveBeenCalledTimes(2);
    expect(mocks.success).toHaveBeenCalledWith("Post published");
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("unpublishes", async () => {
    const { result } = renderHook(useUnpublishPost, { wrapper });
    await act(() => result.current.mutateAsync("p1"));
    expect(mocks.unpublishPostAction).toHaveBeenCalledWith("p1");
    expect(mocks.success).toHaveBeenCalledWith("Moved back to drafts");
  });

  it("deletes and goes back to the list", async () => {
    const { result } = renderHook(useDeletePost, { wrapper });
    await act(() => result.current.mutateAsync("p1"));
    expect(mocks.deletePostAction).toHaveBeenCalledWith("p1");
    expect(mocks.push).toHaveBeenCalledWith("/admin");
  });
});

describe("useUploadImage", () => {
  it("sends the file as form data and resolves to the URL", async () => {
    const { result } = renderHook(useUploadImage, { wrapper });
    const file = new File(["x"], "a.png", { type: "image/png" });
    let url = "";
    await act(async () => {
      url = await result.current.mutateAsync(file);
    });
    expect(url).toBe("https://img/a.png");
    const form = mocks.uploadImageAction.mock.calls[0]?.[0] as FormData;
    expect(form.get("file")).toBeInstanceOf(File);
    expect(mocks.success).toHaveBeenCalledWith("Image uploaded");
  });
});
