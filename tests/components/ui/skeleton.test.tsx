import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  ArticleSkeleton,
  PostCardSkeleton,
  PostGridSkeleton,
  Skeleton,
  TableRowsSkeleton,
  TextSkeleton,
} from "@/components/ui/skeleton";

const shimmers = (container: HTMLElement) =>
  container.querySelectorAll(".animate-shimmer").length;

describe("Skeleton", () => {
  it("is hidden from assistive tech and takes a size", () => {
    const { container } = render(<Skeleton className="h-4 w-10" />);
    const span = container.firstElementChild;
    expect(span).toHaveAttribute("aria-hidden", "true");
    expect(span).toHaveClass("animate-shimmer", "h-4", "w-10");
  });

  it("sizes a text placeholder like a line of text", () => {
    const { container } = render(<TextSkeleton className="w-20" />);
    expect(container.firstElementChild).toHaveClass("h-[1em]", "w-20");
    expect(container.firstElementChild).not.toHaveClass("w-32");
    render(<TextSkeleton />);
  });
});

describe("post skeletons", () => {
  it("draws a card", () => {
    const { container } = render(<PostCardSkeleton />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(shimmers(container)).toBe(5);
  });

  it("draws a grid of six cards by default", () => {
    const { container } = render(<PostGridSkeleton />);
    expect(container.querySelectorAll(".card")).toHaveLength(6);
    const { container: three } = render(<PostGridSkeleton count={3} />);
    expect(three.querySelectorAll(".card")).toHaveLength(3);
  });

  it("draws an article", () => {
    const { container } = render(<ArticleSkeleton />);
    expect(shimmers(container)).toBe(8);
  });
});

describe("TableRowsSkeleton", () => {
  const renderRows = (element: React.ReactNode) =>
    render(
      <table>
        <tbody>{element}</tbody>
      </table>,
    ).container;

  it("draws 5 rows of 4 cells by default", () => {
    const container = renderRows(<TableRowsSkeleton />);
    expect(container.querySelectorAll("tr")).toHaveLength(5);
    expect(container.querySelectorAll("td")).toHaveLength(20);
  });

  it("takes a row and column count", () => {
    const container = renderRows(<TableRowsSkeleton cols={2} rows={3} />);
    expect(container.querySelectorAll("tr")).toHaveLength(3);
    expect(container.querySelectorAll("td")).toHaveLength(6);
  });
});
