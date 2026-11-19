import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminPage: vi.fn(),
  listPostsForAdmin: vi.fn(),
  getPostForEdit: vi.fn(),
}));

vi.mock("@/lib/dal/auth", () => ({ requireAdminPage: mocks.requireAdminPage }));
vi.mock("@/lib/dal/posts", () => ({
  listPostsForAdmin: mocks.listPostsForAdmin,
  getPostForEdit: mocks.getPostForEdit,
}));
vi.mock("@/lib/actions/posts", () => ({}));
vi.mock("@/components/auth-buttons", () => ({
  AuthButtons: () => <div data-testid="auth" />,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/admin",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import AdminLayout, { metadata } from "@/app/(admin)/admin/layout";
import AdminPostsPage from "@/app/(admin)/admin/page";
import EditPostPage from "@/app/(admin)/admin/posts/[id]/page";
import NewPostPage from "@/app/(admin)/admin/posts/new/page";
import { makePost, makeSummary } from "../../components/admin/utils";

/** Renders a page once (like the server) and lets its Suspense holes settle. */
async function renderPage(ui: ReactNode) {
  const client = new QueryClient();
  await act(async () => {
    render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  });
}

beforeEach(() => {
  mocks.requireAdminPage.mockResolvedValue("user_1");
});

describe("AdminLayout", () => {
  it("frames pages with the studio sidebar and stays out of search", () => {
    render(
      <AdminLayout>
        <p>body</p>
      </AdminLayout>,
    );
    expect(screen.getByRole("main")).toHaveTextContent("body");
    expect(screen.getByRole("navigation", { name: "Studio" })).toBeVisible();
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});

describe("AdminPostsPage", () => {
  it("shows the shell right away, without awaiting anything", () => {
    const pending = new Promise<never>(() => {});
    mocks.requireAdminPage.mockReturnValue(pending);
    render(AdminPostsPage({ searchParams: pending }));
    expect(
      screen.getByRole("heading", { level: 1, name: "Posts" }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "New post" })).toHaveAttribute(
      "href",
      "/admin/posts/new",
    );
    expect(screen.getByText("Total posts")).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "Title" })).toBeVisible();
    expect(screen.getByRole("link", { name: "All" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("fills the counts, tabs and rows", async () => {
    mocks.listPostsForAdmin.mockResolvedValue({
      ok: true,
      data: [
        makeSummary({ id: "a", title: "One" }),
        makeSummary({ id: "b", title: "Two", status: "published" }),
      ],
    });
    await renderPage(
      <AdminPostsPage searchParams={Promise.resolve({ status: "draft" })} />,
    );
    expect(await screen.findByRole("link", { name: "One" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Two" })).toBeNull();
    expect(screen.getByRole("link", { name: "Drafts" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByText("Total posts").nextSibling).toHaveTextContent("2");
  });
});

describe("editor pages", () => {
  it("opens a blank editor for a new post", async () => {
    await renderPage(<NewPostPage searchParams={Promise.resolve({})} />);
    expect(
      screen.getByRole("heading", { level: 1, name: "New post" }),
    ).toBeVisible();
    expect(await screen.findByPlaceholderText("Post title")).toHaveValue("");
  });

  it("opens the post being edited", async () => {
    const post = makePost({ title: "Existing" });
    mocks.getPostForEdit.mockResolvedValue({ ok: true, data: post });
    await renderPage(
      <EditPostPage params={Promise.resolve({ id: post.id })} />,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Edit post" }),
    ).toBeVisible();
    expect(await screen.findByPlaceholderText("Post title")).toHaveValue(
      "Existing",
    );
    expect(mocks.getPostForEdit).toHaveBeenCalledWith("user_1", post.id);
  });
});
