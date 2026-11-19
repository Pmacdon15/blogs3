import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

import { PostEditor } from "@/components/admin/post-editor";
import type { Post } from "@/lib/types";
import { makePost, renderWithClient } from "./utils";

const post = makePost();
const ok = (data: unknown) => Promise.resolve({ ok: true, data });

beforeEach(() => {
  mocks.createPostAction.mockImplementation((input: Partial<Post>) =>
    ok({ ...post, ...input }),
  );
  mocks.updatePostAction.mockImplementation(
    (_id: string, patch: Partial<Post>) => ok({ ...post, ...patch }),
  );
  mocks.publishPostAction.mockImplementation(() =>
    ok({ ...post, status: "published" }),
  );
  mocks.unpublishPostAction.mockImplementation(() =>
    ok({ ...post, status: "draft" }),
  );
  mocks.deletePostAction.mockImplementation(() => ok({ id: post.id }));
});

const title = () => screen.getByPlaceholderText("Post title");
const slug = () => screen.getByLabelText("Slug");
const button = (name: string | RegExp) => screen.getByRole("button", { name });

describe("PostEditor (create)", () => {
  it("fills the slug from the title until it's edited", async () => {
    const user = userEvent.setup();
    renderWithClient(<PostEditor mode="create" />);
    expect(screen.getByText("All changes saved")).toBeVisible();
    await user.type(title(), "Hello, World!");
    expect(slug()).toHaveValue("hello-world");
    expect(screen.getByText("Unsaved changes")).toBeVisible();

    await user.clear(slug());
    await user.type(slug(), "custom");
    await user.type(title(), " again");
    expect(slug()).toHaveValue("custom");

    await user.click(button("From title"));
    expect(slug()).toHaveValue("hello-world-again");
    expect(screen.queryByRole("button", { name: "From title" })).toBeNull();
  });

  it("validates with the schema before calling the server", async () => {
    const user = userEvent.setup();
    renderWithClient(<PostEditor mode="create" />);
    await user.click(button("Save draft"));
    expect(mocks.error).toHaveBeenCalledWith(
      "Fix the highlighted fields first.",
    );
    expect(title()).toHaveAccessibleDescription("Title is required");
    expect(slug()).toHaveAttribute("aria-invalid", "true");
    fireEvent.change(screen.getByLabelText("Excerpt"), {
      target: { value: "x".repeat(301) },
    });
    await user.click(button("Publish"));
    expect(screen.getByLabelText("Excerpt")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(mocks.createPostAction).not.toHaveBeenCalled();
  });

  it("creates a draft with every field", async () => {
    const user = userEvent.setup();
    renderWithClient(<PostEditor mode="create" />);
    await user.type(title(), "My post");
    await user.type(screen.getByLabelText("Excerpt"), "Short");
    await user.type(screen.getByLabelText("Tags"), "News{Enter}");
    await user.type(screen.getByLabelText("Cover image"), "https://img/c.png");
    await user.click(screen.getByRole("button", { name: "Text" }));
    await user.type(screen.getByLabelText("Text block 1"), "Body");
    await user.click(button("Save draft"));
    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith(`/admin/posts/${post.id}`),
    );
    expect(mocks.createPostAction).toHaveBeenCalledWith({
      title: "My post",
      slug: "my-post",
      excerpt: "Short",
      coverImageUrl: "https://img/c.png",
      tags: ["news"],
      blocks: [expect.objectContaining({ type: "text", text: "Body" })],
    });
    expect(mocks.publishPostAction).not.toHaveBeenCalled();
  });

  it("can publish straight away", async () => {
    const user = userEvent.setup();
    renderWithClient(<PostEditor mode="create" />);
    await user.type(title(), "Now");
    await user.click(button("Publish"));
    await waitFor(() =>
      expect(mocks.publishPostAction).toHaveBeenCalledWith(post.id),
    );
    expect(mocks.success).toHaveBeenCalledWith("Post published");
  });

  it("shows the server's field errors inline", async () => {
    mocks.createPostAction.mockResolvedValueOnce({
      ok: false,
      error: "Another post already uses that slug.",
      fieldErrors: { slug: ["Another post already uses that slug."] },
    });
    mocks.createPostAction.mockResolvedValueOnce({ ok: false, error: "Down" });
    const user = userEvent.setup();
    renderWithClient(<PostEditor mode="create" />);
    await user.type(title(), "Taken");
    await user.click(button("Save draft"));
    await waitFor(() =>
      expect(slug()).toHaveAccessibleDescription(
        "Another post already uses that slug.",
      ),
    );
    await user.click(button("Save draft"));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("Down"));
    expect(slug()).not.toHaveAttribute("aria-invalid");
  });

  it("saves on Ctrl/⌘+S and ignores other keys", async () => {
    const user = userEvent.setup();
    renderWithClient(<PostEditor mode="create" />);
    await user.type(title(), "Keys");
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    fireEvent.keyDown(window, { key: "s" });
    expect(mocks.createPostAction).not.toHaveBeenCalled();
    mocks.createPostAction.mockReturnValueOnce(new Promise(() => {}));
    fireEvent.keyDown(window, { key: "S", metaKey: true });
    await waitFor(() => expect(screen.getByText("Saving…")).toBeVisible());
    // A second shortcut while saving does nothing.
    fireEvent.keyDown(window, { key: "s", ctrlKey: true });
    expect(mocks.createPostAction).toHaveBeenCalledOnce();
  });

  it("warns before leaving with unsaved changes", async () => {
    const user = userEvent.setup();
    renderWithClient(<PostEditor mode="create" />);
    const clean = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
    await user.type(title(), "x");
    const dirty = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
  });

  it("previews the post with complete blocks only", async () => {
    const user = userEvent.setup();
    const { container } = renderWithClient(<PostEditor mode="create" />);
    await user.click(button("Preview"));
    expect(screen.getByRole("heading", { name: "Untitled" })).toBeVisible();
    expect(button("Edit")).toHaveAttribute("aria-pressed", "true");
    await user.click(button("Edit"));

    await user.type(title(), "Shown");
    await user.type(screen.getByLabelText("Excerpt"), "Teaser");
    await user.type(screen.getByLabelText("Cover image"), "https://img/c.png");
    await user.click(screen.getByRole("button", { name: "Heading" }));
    await user.type(screen.getByLabelText("Heading block 1"), "Part one");
    await user.click(screen.getByRole("button", { name: "Text" }));
    await user.click(button("Preview"));
    expect(screen.getByRole("heading", { name: "Shown" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Part one" })).toBeVisible();
    expect(screen.getByText("Teaser")).toBeVisible();
    expect(
      container.querySelector('img[src="https://img/c.png"]'),
    ).not.toBeNull();
    expect(screen.getByText("1 incomplete block is hidden.")).toBeVisible();

    await user.click(button("Edit"));
    await user.click(screen.getByRole("button", { name: "Code" }));
    await user.click(button("Preview"));
    expect(screen.getByText("2 incomplete blocks are hidden.")).toBeVisible();
  });
});

describe("PostEditor (edit)", () => {
  it("saves changes and takes the server's copy as clean", async () => {
    const user = userEvent.setup();
    renderWithClient(<PostEditor mode="edit" post={post} />);
    expect(screen.getByText("Draft")).toBeVisible();
    expect(slug()).toHaveValue("hello-world");
    await user.type(title(), "!");
    expect(slug()).toHaveValue("hello-world");
    await user.click(button("Save draft"));
    await waitFor(() =>
      expect(screen.getByText("All changes saved")).toBeVisible(),
    );
    expect(mocks.updatePostAction).toHaveBeenCalledWith(
      post.id,
      expect.objectContaining({ title: "Hello world!" }),
    );
    expect(mocks.refresh).toHaveBeenCalled();
    expect(title()).toHaveValue("Hello world!");
  });

  it("shows server field errors from an update", async () => {
    mocks.updatePostAction.mockResolvedValueOnce({
      ok: false,
      error: "Bad title",
      fieldErrors: { title: ["Bad title"] },
    });
    const user = userEvent.setup();
    renderWithClient(<PostEditor mode="edit" post={post} />);
    await user.click(button("Save draft"));
    await waitFor(() =>
      expect(title()).toHaveAccessibleDescription("Bad title"),
    );
  });

  it("publishes (saving first only when dirty) and unpublishes", async () => {
    const user = userEvent.setup();
    renderWithClient(<PostEditor mode="edit" post={post} />);
    await user.click(button("Publish"));
    await waitFor(() => expect(screen.getByText("Published")).toBeVisible());
    expect(mocks.updatePostAction).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "View" })).toHaveAttribute(
      "href",
      "/blog/hello-world",
    );
    expect(button("Save changes")).toBeVisible();

    await user.click(button("Unpublish"));
    await waitFor(() => expect(screen.getByText("Draft")).toBeVisible());
    expect(mocks.unpublishPostAction).toHaveBeenCalledWith(post.id);

    await user.type(screen.getByLabelText("Excerpt"), "!");
    await user.click(button("Publish"));
    await waitFor(() =>
      expect(mocks.updatePostAction).toHaveBeenCalledWith(
        post.id,
        expect.objectContaining({ excerpt: "An intro!" }),
      ),
    );
    expect(mocks.publishPostAction).toHaveBeenCalledTimes(2);
  });

  it("keeps field errors when publishing fails validation on the server", async () => {
    mocks.publishPostAction.mockResolvedValueOnce({
      ok: false,
      error: "Add some content before publishing.",
    });
    const user = userEvent.setup();
    renderWithClient(<PostEditor mode="edit" post={post} />);
    await user.click(button("Publish"));
    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith(
        "Add some content before publishing.",
      ),
    );
  });

  it("deletes after confirming", async () => {
    const user = userEvent.setup();
    renderWithClient(
      <PostEditor
        mode="edit"
        post={makePost({ status: "published", title: "" })}
      />,
    );
    await user.click(button("Delete"));
    expect(screen.getByRole("alertdialog")).toHaveAccessibleDescription(
      /"Untitled" will be removed/,
    );
    await user.click(button("Cancel"));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(mocks.deletePostAction).not.toHaveBeenCalled();

    await user.click(button("Delete"));
    await act(async () => {
      await user.click(button("Delete post"));
    });
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/admin"));
    expect(mocks.deletePostAction).toHaveBeenCalledWith(post.id);
  });
});
