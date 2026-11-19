import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminPage: vi.fn(),
  listPostsForAdmin: vi.fn(),
  getPostForEdit: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  editorProps: vi.fn(),
}));

vi.mock("@/lib/dal/auth", () => ({ requireAdminPage: mocks.requireAdminPage }));
vi.mock("@/lib/dal/posts", () => ({
  listPostsForAdmin: mocks.listPostsForAdmin,
  getPostForEdit: mocks.getPostForEdit,
}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/components/admin/post-editor", () => ({
  PostEditor: (props: Record<string, unknown>) => {
    mocks.editorProps(props);
    return <div data-testid="editor" />;
  },
}));

import {
  ActiveStatusTabs,
  PostRowsHole,
  StatValue,
} from "@/components/admin/dashboard";
import {
  EditorSkeleton,
  EditPostHole,
  NewPostHole,
} from "@/components/admin/editor-holes";
import { makePost, makeSummary } from "./utils";

const posts = [
  makeSummary({ id: "a", title: "Draft one" }),
  makeSummary({ id: "b", title: "Live one", status: "published" }),
  makeSummary({ id: "c", title: "Draft two" }),
];

beforeEach(() => {
  mocks.requireAdminPage.mockResolvedValue("user_1");
  mocks.listPostsForAdmin.mockResolvedValue({ ok: true, data: posts });
});

const table = (ui: ReactElement) =>
  render(
    <table>
      <tbody>{ui}</tbody>
    </table>,
  );

describe("dashboard holes", () => {
  it("reads the URL, then the admin, then the posts", async () => {
    const order: string[] = [];
    const searchParams = Promise.resolve({ status: "published" }).then((p) => {
      order.push("url");
      return p;
    });
    mocks.requireAdminPage.mockImplementation(async () => {
      order.push("session");
      return "user_1";
    });
    table(await PostRowsHole({ searchParams }));
    expect(order).toEqual(["url", "session"]);
    expect(mocks.listPostsForAdmin).toHaveBeenCalledWith("user_1");
    expect(screen.getByText("Live one")).toBeInTheDocument();
    expect(screen.queryByText("Draft one")).toBeNull();
  });

  it("counts posts by status", async () => {
    render(
      <>
        <span data-testid="total">
          {
            await StatValue({
              kind: "total",
              searchParams: Promise.resolve({}),
            })
          }
        </span>
        <span data-testid="draft">
          {
            await StatValue({
              kind: "draft",
              searchParams: Promise.resolve({}),
            })
          }
        </span>
        <span data-testid="published">
          {
            await StatValue({
              kind: "published",
              searchParams: Promise.resolve({}),
            })
          }
        </span>
      </>,
    );
    expect(screen.getByTestId("total")).toHaveTextContent("3");
    expect(screen.getByTestId("draft")).toHaveTextContent("2");
    expect(screen.getByTestId("published")).toHaveTextContent("1");
  });

  it("throws to the error boundary when the list can't be read", async () => {
    mocks.listPostsForAdmin.mockResolvedValue({ ok: false, error: "Nope" });
    await expect(
      StatValue({ kind: "total", searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("Nope");
  });

  it("marks the tab from the URL", async () => {
    render(
      await ActiveStatusTabs({
        searchParams: Promise.resolve({ status: "draft" }),
      }),
    );
    expect(screen.getByRole("link", { name: "Drafts" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});

describe("editor holes", () => {
  it("checks the admin after the URL, then opens a blank editor", async () => {
    render(await NewPostHole({ searchParams: Promise.resolve({}) }));
    expect(mocks.requireAdminPage).toHaveBeenCalled();
    expect(mocks.editorProps).toHaveBeenCalledWith({ mode: "create" });
  });

  it("loads the post for editing", async () => {
    const post = makePost();
    mocks.getPostForEdit.mockResolvedValue({ ok: true, data: post });
    render(await EditPostHole({ params: Promise.resolve({ id: post.id }) }));
    expect(mocks.getPostForEdit).toHaveBeenCalledWith("user_1", post.id);
    expect(mocks.editorProps).toHaveBeenCalledWith({ mode: "edit", post });
  });

  it("404s for a missing post", async () => {
    mocks.getPostForEdit.mockResolvedValue({
      ok: false,
      error: "Post not found.",
    });
    await expect(
      EditPostHole({ params: Promise.resolve({ id: "x" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("has a sized skeleton", () => {
    const { container } = render(<EditorSkeleton />);
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
  });
});
