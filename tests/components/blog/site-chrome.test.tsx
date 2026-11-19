import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Logo } from "@/components/blog/logo";
import { SiteFooter } from "@/components/blog/site-footer";
import { SiteHeader } from "@/components/blog/site-header";

describe("Logo", () => {
  it("links home", () => {
    render(<Logo />);
    expect(screen.getByRole("link", { name: "Blogs3 home" })).toHaveAttribute(
      "href",
      "/",
    );
  });
});

describe("SiteHeader", () => {
  it("has the wordmark and main nav, and no auth UI", () => {
    render(<SiteHeader />);
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Main" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Posts" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("SiteFooter", () => {
  it("links to all posts and, quietly, the admin", () => {
    render(<SiteFooter />);
    expect(screen.getByRole("link", { name: "All posts" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: "Admin" })).toHaveAttribute(
      "href",
      "/admin",
    );
  });
});
