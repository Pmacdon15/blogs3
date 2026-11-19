import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  isBlobUrl,
  PostBlocks,
  paragraphs,
} from "@/components/blog/post-blocks";

describe("isBlobUrl", () => {
  it("recognises the Blob store host", () => {
    expect(isBlobUrl("https://abc.public.blob.vercel-storage.com/a.png")).toBe(
      true,
    );
    expect(isBlobUrl("https://example.com/a.png")).toBe(false);
  });
});

describe("paragraphs", () => {
  it("splits on blank lines, keyed by offset, skipping empty parts", () => {
    expect(paragraphs("One\nline\n\n\nTwo\n\n  ")).toEqual([
      { key: 0, text: "One\nline" },
      { key: 11, text: "Two" },
    ]);
  });
});

describe("PostBlocks", () => {
  it("renders every block type as text, never HTML", () => {
    const { container } = render(
      <PostBlocks
        blocks={[
          { id: "h1", type: "heading", text: "Intro" },
          { id: "t1", type: "text", text: "First <b>para</b>\n\nSecond" },
          {
            id: "i1",
            type: "image",
            url: "https://abc.public.blob.vercel-storage.com/a.png",
            alt: "A chart",
            caption: "Figure 1",
          },
          {
            id: "i2",
            type: "image",
            url: "https://example.com/b.png",
            alt: "Other",
          },
          { id: "c1", type: "code", language: "bash", code: "echo hi" },
        ]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Intro" })).toHaveAttribute(
      "id",
      "h1",
    );
    expect(screen.getByText("First <b>para</b>")).toBeInTheDocument();
    expect(container.querySelector("b")).toBeNull();
    expect(screen.getByText("Second")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "A chart" })).toBeInTheDocument();
    expect(screen.getByText("Figure 1").tagName).toBe("FIGCAPTION");
    expect(screen.getByRole("img", { name: "Other" })).toHaveAttribute(
      "src",
      "https://example.com/b.png",
    );
    expect(container.querySelectorAll("figcaption")).toHaveLength(1);
    expect(screen.getByText("echo hi").tagName).toBe("CODE");
    expect(screen.getByText("bash")).toBeInTheDocument();
  });
});
