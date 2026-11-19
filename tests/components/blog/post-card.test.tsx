import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CoverImage } from "@/components/blog/cover-image";
import { PostCard, postHref } from "@/components/blog/post-card";
import { EmptyPosts, PostList } from "@/components/blog/post-list";
import { PostMeta } from "@/components/blog/post-meta";
import { TagList } from "@/components/blog/tag-list";
import { makeSummary } from "./fixtures";

describe("PostMeta", () => {
  it("shows the date and reading time", () => {
    render(<PostMeta minutes={3} publishedAt="2026-11-19T10:00:00.000Z" />);
    expect(screen.getByText("Nov 19, 2026")).toHaveAttribute(
      "dateTime",
      "2026-11-19T10:00:00.000Z",
    );
    expect(screen.getByText("3 min read")).toBeInTheDocument();
  });

  it("shows only what it has", () => {
    const { container, rerender } = render(<PostMeta publishedAt={null} />);
    expect(container.textContent).toBe("");
    rerender(<PostMeta minutes={2} publishedAt={null} />);
    expect(container.textContent).toBe("2 min read");
  });
});

describe("TagList", () => {
  it("renders tags as chips", () => {
    render(<TagList tags={["a", "b"]} />);
    expect(
      within(screen.getByRole("list", { name: "Tags" })).getAllByRole(
        "listitem",
      ),
    ).toHaveLength(2);
    expect(screen.getByText("#a")).toBeInTheDocument();
  });

  it("renders nothing without tags", () => {
    const { container } = render(<TagList tags={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("CoverImage", () => {
  it("shows the image, optimised only for Blob URLs", () => {
    render(
      <CoverImage
        alt="cover"
        sizes="100vw"
        url="https://abc.public.blob.vercel-storage.com/a.png"
      />,
    );
    expect(
      screen.getByRole("img", { name: "cover" }).getAttribute("src"),
    ).toContain("/_next/image");
  });

  it("falls back to a gradient", () => {
    const { container } = render(
      <CoverImage alt="" sizes="100vw" url={null} />,
    );
    expect(container.querySelector("img")).toBeNull();
  });
});

describe("PostCard", () => {
  it("links the title to the post", () => {
    render(<PostCard post={makeSummary()} />);
    expect(screen.getByRole("link", { name: "Hello world" })).toHaveAttribute(
      "href",
      "/blog/hello-world",
    );
    expect(screen.getByText("A first post.")).toBeInTheDocument();
    expect(screen.queryByText("Featured")).not.toBeInTheDocument();
  });

  it("marks the featured card and hides an empty excerpt", () => {
    const { container } = render(
      <PostCard
        featured
        post={makeSummary({
          excerpt: "",
          coverImageUrl: "https://example.com/c.png",
        })}
      />,
    );
    expect(screen.getByText("Featured")).toBeInTheDocument();
    expect(screen.queryByText("A first post.")).not.toBeInTheDocument();
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://example.com/c.png",
    );
  });

  it("builds post hrefs", () => {
    expect(postHref("a-b")).toBe("/blog/a-b");
  });
});

describe("PostList", () => {
  it("features the first post and grids the rest", () => {
    render(
      <PostList
        posts={[
          makeSummary({ id: "1", title: "One", slug: "one" }),
          makeSummary({ id: "2", title: "Two", slug: "two" }),
        ]}
      />,
    );
    const articles = screen.getAllByRole("article");
    expect(articles).toHaveLength(2);
    expect(within(articles[0]).getByText("Featured")).toBeInTheDocument();
    expect(within(articles[1]).queryByText("Featured")).toBeNull();
  });

  it("shows a single post without a grid", () => {
    render(<PostList posts={[makeSummary()]} />);
    expect(screen.getAllByRole("article")).toHaveLength(1);
  });

  it("shows the empty state without posts", () => {
    render(<PostList posts={[]} />);
    expect(
      screen.getByRole("heading", { name: "No posts yet" }),
    ).toBeInTheDocument();
    render(<EmptyPosts />);
  });
});
