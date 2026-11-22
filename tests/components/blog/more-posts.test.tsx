import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeSummary } from "./fixtures";

type PagesState = {
  posts: ReturnType<typeof makeSummary>[];
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isError: boolean;
};

const mocks = vi.hoisted(() => ({
  usePostPages: vi.fn(),
  fetchNextPage: vi.fn(async () => undefined),
}));

vi.mock("@/hooks/use-post-pages", () => ({
  usePostPages: mocks.usePostPages,
}));

import { MorePosts, useNearViewport } from "@/components/blog/more-posts";

const cursor = {
  before: "2026-11-19T10:00:00.000Z",
  beforeId: "00000000-0000-4000-8000-000000000000",
};

let state: PagesState;
function setState(next: Partial<PagesState>) {
  state = { ...state, ...next };
}

/** A stand-in IntersectionObserver whose callbacks the tests fire by hand. */
const observers: {
  callback: IntersectionObserverCallback;
  disconnect: () => void;
}[] = [];
class FakeObserver {
  disconnect = vi.fn();
  observe = vi.fn();
  constructor(callback: IntersectionObserverCallback) {
    observers.push({ callback, disconnect: this.disconnect });
  }
}
function intersect(isIntersecting: boolean) {
  act(() => {
    observers
      .at(-1)
      ?.callback(
        [{ isIntersecting } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
  });
}

beforeEach(() => {
  observers.length = 0;
  vi.stubGlobal("IntersectionObserver", FakeObserver);
  state = {
    posts: [],
    hasNextPage: true,
    isFetchingNextPage: false,
    isError: false,
  };
  mocks.usePostPages.mockImplementation(() => ({
    data: { pages: [{ posts: state.posts, nextCursor: cursor }] },
    hasNextPage: state.hasNextPage,
    isFetchingNextPage: state.isFetchingNextPage,
    isError: state.isError,
    fetchNextPage: mocks.fetchNextPage,
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("MorePosts", () => {
  it("starts from the cursor with a load-more button and no cards", () => {
    render(<MorePosts cursor={cursor} />);
    expect(mocks.usePostPages).toHaveBeenCalledWith(cursor);
    expect(screen.queryByRole("article")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Load more posts" }),
    ).toBeEnabled();
  });

  it("loads the next page as the end nears the viewport", () => {
    render(<MorePosts cursor={cursor} />);
    intersect(false);
    expect(mocks.fetchNextPage).not.toHaveBeenCalled();
    intersect(true);
    expect(mocks.fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it("loads the next page from the button", async () => {
    render(<MorePosts cursor={cursor} />);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Load more posts" }));
    expect(mocks.fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it("shows loaded posts and skeletons while the next page loads", () => {
    setState({
      posts: [makeSummary({ id: "a", title: "Older post" })],
      isFetchingNextPage: true,
    });
    const { container } = render(<MorePosts cursor={cursor} />);
    expect(screen.getByText("Older post")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Load more posts" }),
    ).toBeDisabled();
    expect(
      container.querySelectorAll(".animate-shimmer").length,
    ).toBeGreaterThan(0);
    intersect(true);
    expect(mocks.fetchNextPage).not.toHaveBeenCalled();
  });

  it("stops auto-loading after an error and offers a retry", async () => {
    setState({ isError: true });
    render(<MorePosts cursor={cursor} />);
    intersect(true);
    expect(mocks.fetchNextPage).not.toHaveBeenCalled();
    expect(screen.getByText("Couldn’t load more posts.")).toBeInTheDocument();
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Try again" }));
    expect(mocks.fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it("says when every post is shown", () => {
    setState({ hasNextPage: false });
    render(<MorePosts cursor={cursor} />);
    intersect(true);
    expect(mocks.fetchNextPage).not.toHaveBeenCalled();
    expect(screen.getByText("That’s every post.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("useNearViewport", () => {
  it("tracks the latest intersection and disconnects on unmount", () => {
    const div = document.createElement("div");
    const { result, unmount } = renderHook(() => {
      const [ref, isNear] = useNearViewport<HTMLDivElement>();
      ref.current = div;
      return isNear;
    });
    expect(result.current).toBe(false);
    intersect(true);
    expect(result.current).toBe(true);
    act(() => {
      observers[0].callback([], {} as IntersectionObserver);
    });
    expect(result.current).toBe(true);
    intersect(false);
    expect(result.current).toBe(false);
    unmount();
    expect(observers[0].disconnect).toHaveBeenCalled();
  });

  it("does nothing without an element or IntersectionObserver", () => {
    renderHook(() => useNearViewport());
    expect(observers).toHaveLength(0);
    vi.stubGlobal("IntersectionObserver", undefined);
    const { container } = render(<MorePosts cursor={cursor} />);
    expect(container.textContent).toContain("Load more posts");
  });
});
