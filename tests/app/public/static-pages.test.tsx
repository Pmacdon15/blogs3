import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@clerk/nextjs", () => ({
  SignIn: () => <div data-testid="clerk-sign-in" />,
  SignUp: () => <div data-testid="clerk-sign-up" />,
}));

import AboutPage, {
  metadata as aboutMetadata,
} from "@/app/(public)/about/page";
import PostNotFound from "@/app/(public)/blog/[slug]/not-found";
import PublicLayout from "@/app/(public)/layout";
import SignInPage, {
  metadata as signInMetadata,
  generateStaticParams as signInParams,
} from "@/app/(public)/sign-in/[[...sign-in]]/page";
import SignUpPage, {
  metadata as signUpMetadata,
  generateStaticParams as signUpParams,
} from "@/app/(public)/sign-up/[[...sign-up]]/page";
import NotFound from "@/app/not-found";

describe("public layout", () => {
  it("frames the page with the header, main and footer, and no auth UI", () => {
    render(
      <PublicLayout>
        <p>Content</p>
      </PublicLayout>,
    );
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveTextContent("Content");
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(screen.queryByText(/sign in/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Admin" })).toHaveAttribute(
      "href",
      "/admin",
    );
  });
});

describe("about page", () => {
  it("introduces the author with links, skills and projects", () => {
    const { container } = render(<AboutPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Hi, I'm Patrick" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Calgary, Alberta")).toBeInTheDocument();
    const github = screen.getByRole("link", { name: /^GitHub/ });
    expect(github).toHaveAttribute("href", "https://github.com/pmacdon15");
    expect(github).toHaveAttribute("rel", "me noopener");
    expect(screen.getByText("Next.js")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Landscape Friend/ }),
    ).toHaveAttribute("href", "https://landscapefriend.com");
    const jsonLd = container.querySelector(
      'script[type="application/ld+json"]',
    );
    expect(jsonLd?.textContent).toContain('"ProfilePage"');
  });

  it("has its own title and canonical URL", () => {
    expect(aboutMetadata.title).toBe("About");
    expect(aboutMetadata.alternates).toEqual({ canonical: "/about" });
  });
});

describe("not found pages", () => {
  it("renders the global 404 in the public frame", () => {
    render(<NotFound />);
    expect(
      screen.getByRole("heading", { level: 1, name: "This page wandered off" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to the blog" }),
    ).toHaveAttribute("href", "/");
  });

  it("renders the missing-post page", () => {
    render(<PostNotFound />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Post not found" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Browse all posts" }),
    ).toHaveAttribute("href", "/");
  });
});

describe("auth pages", () => {
  it("prerender only their catch-all root", () => {
    expect(signInParams()).toEqual([{ "sign-in": [] }]);
    expect(signUpParams()).toEqual([{ "sign-up": [] }]);
  });

  it("render Clerk's sign-in and sign-up", () => {
    render(<SignInPage />);
    expect(screen.getByTestId("clerk-sign-in")).toBeInTheDocument();
    render(<SignUpPage />);
    expect(screen.getByTestId("clerk-sign-up")).toBeInTheDocument();
  });

  it("mark auth pages noindex", () => {
    expect(signInMetadata).toEqual({
      title: "Sign in",
      robots: { index: false, follow: false },
    });
    expect(signUpMetadata).toEqual({
      title: "Sign up",
      robots: { index: false, follow: false },
    });
  });
});
