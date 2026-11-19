import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ pathname: "/admin", authProps: vi.fn() }));

vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname }));
vi.mock("@/components/auth-buttons", () => ({
  AuthButtons: (props: Record<string, unknown>) => {
    mocks.authProps(props);
    return <div data-testid="auth" />;
  },
}));

import {
  AdminSidebar,
  NAV_ITEMS,
  NavLinks,
} from "@/components/admin/admin-sidebar";

beforeEach(() => {
  mocks.pathname = "/admin";
  // jsdom can't follow links; the tests only care about the click.
  const stop = (event: Event) => event.preventDefault();
  document.addEventListener("click", stop);
  return () => document.removeEventListener("click", stop);
});

const current = () =>
  screen
    .getAllByRole("link")
    .filter((link) => link.getAttribute("aria-current") === "page")
    .map((link) => link.textContent);

describe("AdminSidebar", () => {
  it("links every studio page plus the site, with only the user menu", () => {
    render(<AdminSidebar />);
    for (const [name, href] of [
      ["Posts", "/admin"],
      ["New post", "/admin/posts/new"],
      ["MCP connect", "/admin/mcp"],
      ["View site", "/"],
    ]) {
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", href);
    }
    expect(screen.getByTestId("auth")).toBeInTheDocument();
    expect(mocks.authProps).toHaveBeenCalledWith({ showAdminLink: false });
    expect(current()).toEqual(["Posts"]);
  });

  it.each([
    ["/admin/posts/abc", "Posts"],
    ["/admin/posts/new", "New post"],
    ["/admin/mcp", "MCP connect"],
  ])("marks %s as %s", (pathname, label) => {
    mocks.pathname = pathname;
    render(<AdminSidebar />);
    expect(current()).toEqual([label]);
  });

  it("opens and closes the mobile menu", async () => {
    const user = userEvent.setup();
    render(<AdminSidebar />);
    const nav = document.getElementById("admin-nav");
    expect(nav).toHaveClass("hidden");
    await user.click(screen.getByRole("button", { name: "Open menu" }));
    expect(nav).toHaveClass("flex");
    expect(screen.getByRole("button", { name: "Close menu" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await user.click(screen.getByRole("link", { name: "New post" }));
    expect(nav).toHaveClass("hidden");
    await user.click(screen.getByRole("button", { name: "Open menu" }));
    await user.click(screen.getByRole("button", { name: "Close menu" }));
    expect(nav).toHaveClass("hidden");
  });

  it("renders unmarked links without a pathname (the static fallback)", () => {
    render(<NavLinks onNavigate={vi.fn()} />);
    expect(screen.getAllByRole("link")).toHaveLength(NAV_ITEMS.length);
    expect(current()).toEqual([]);
  });
});
