import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSummary } from "./fixtures";

type SearchState = {
  data?: ReturnType<typeof makeSummary>[];
  isError: boolean;
  isFetching: boolean;
};

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  usePostSearch: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/hooks/use-post-search", () => ({
  MIN_SEARCH_LENGTH: 2,
  usePostSearch: mocks.usePostSearch,
}));

import {
  SearchBar,
  statusText,
  useDebouncedValue,
} from "@/components/blog/search-bar";

const posts = [
  makeSummary({ id: "1", slug: "one", title: "Post one" }),
  makeSummary({
    id: "2",
    slug: "two",
    title: "Post two",
    publishedAt: null,
    excerpt: "",
  }),
];

let state: SearchState;
function setState(next: Partial<SearchState>) {
  state = { ...state, ...next };
}

beforeEach(() => {
  state = { data: posts, isError: false, isFetching: false };
  mocks.usePostSearch.mockImplementation(() => state);
});

const input = () => screen.getByRole("combobox", { name: "Search posts" });

async function typeQuery(text: string) {
  const user = userEvent.setup();
  render(<SearchBar />);
  await user.type(input(), text);
  await screen.findByRole("option", { name: /Post one/ });
  return user;
}

describe("useDebouncedValue", () => {
  it("updates after the delay", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 250),
      { initialProps: { value: "a" } },
    );
    rerender({ value: "ab" });
    expect(result.current).toBe("a");
    act(() => vi.advanceTimersByTime(250));
    expect(result.current).toBe("ab");
  });
});

describe("statusText", () => {
  const base = { ready: true, isError: false, hasData: true, query: "ab" };
  it("describes each state", () => {
    expect(statusText({ ...base, ready: false, count: 0 })).toBe("Searching…");
    expect(statusText({ ...base, hasData: false, count: 0 })).toBe(
      "Searching…",
    );
    expect(
      statusText({ ...base, isError: true, hasData: false, count: 0 }),
    ).toBe("Search is unavailable right now.");
    expect(statusText({ ...base, count: 0 })).toBe("No posts match “ab”.");
    expect(statusText({ ...base, count: 1 })).toBe("1 result");
    expect(statusText({ ...base, count: 3 })).toBe("3 results");
  });
});

describe("SearchBar", () => {
  it("is a closed combobox until two characters are typed", async () => {
    const user = userEvent.setup();
    render(<SearchBar />);
    expect(input()).toHaveAttribute("aria-expanded", "false");
    await user.type(input(), "p");
    expect(input()).toHaveAttribute("aria-expanded", "false");
    expect(mocks.usePostSearch).toHaveBeenLastCalledWith("");
  });

  it("debounces the query and lists linked results", async () => {
    await typeQuery("  post ");
    expect(mocks.usePostSearch).toHaveBeenLastCalledWith("post");
    expect(input()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("status")).toHaveTextContent("2 results");
    expect(screen.getByRole("link", { name: /Post one/ })).toHaveAttribute(
      "href",
      "/blog/one",
    );
    expect(
      screen.getByText(/Nov 19, 2026 · A first post\./),
    ).toBeInTheDocument();
  });

  it("shows a spinner while typing and fetching", async () => {
    setState({ isFetching: true });
    const user = userEvent.setup();
    render(<SearchBar />);
    await user.type(input(), "po");
    expect(screen.getByTestId("search-spinner")).toBeInTheDocument();
    await screen.findByRole("option", { name: /Post one/ });
    expect(screen.getByTestId("search-spinner")).toBeInTheDocument();
    setState({ isFetching: false });
    await user.type(input(), "s");
    await screen.findByRole("button", { name: "Clear search" });
  });

  it("moves through options with the arrow keys and opens one with Enter", async () => {
    const user = await typeQuery("post");
    const [one, two] = screen.getAllByRole("option");

    await user.keyboard("{ArrowDown}");
    expect(one).toHaveAttribute("aria-selected", "true");
    expect(input()).toHaveAttribute("aria-activedescendant", one.id);
    await user.keyboard("{ArrowDown}");
    expect(two).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowDown}");
    expect(one).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowUp}");
    expect(two).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowUp}");
    expect(one).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowUp}");
    expect(two).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{Enter}");
    expect(mocks.push).toHaveBeenCalledWith("/blog/two");
    expect(input()).toHaveAttribute("aria-expanded", "false");
  });

  it("drops the active option when the results shrink", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<SearchBar />);
    await user.type(input(), "post");
    await screen.findByRole("option", { name: /Post one/ });
    await user.keyboard("{ArrowDown}{ArrowDown}");
    setState({ data: [posts[0]] });
    rerender(<SearchBar />);
    expect(screen.getByRole("option")).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(input()).not.toHaveAttribute("aria-activedescendant");
  });

  it("does nothing on Enter without an active option", async () => {
    const user = await typeQuery("post");
    await user.keyboard("{Enter}");
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("activates an option on hover and closes after a click", async () => {
    const user = await typeQuery("post");
    const link = screen.getByRole("link", { name: /Post two/ });
    await user.hover(link);
    expect(screen.getAllByRole("option")[1]).toHaveAttribute(
      "aria-selected",
      "true",
    );
    link.addEventListener("click", (event) => event.preventDefault());
    await user.click(link);
    expect(input()).toHaveAttribute("aria-expanded", "false");
    expect(input()).toHaveFocus();
  });

  it("closes on Escape, then clears on a second Escape", async () => {
    const user = await typeQuery("post");
    await user.keyboard("{Escape}");
    expect(input()).toHaveAttribute("aria-expanded", "false");
    expect(input()).toHaveValue("post");
    await user.keyboard("{ArrowDown}");
    expect(input()).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{Escape}{Escape}");
    expect(input()).toHaveValue("");
  });

  it("closes on blur and reopens on focus", async () => {
    const user = await typeQuery("post");
    await user.tab();
    expect(input()).toHaveAttribute("aria-expanded", "false");
    await user.click(input());
    expect(input()).toHaveAttribute("aria-expanded", "true");
  });

  it("clears the input with the clear button", async () => {
    const user = await typeQuery("post");
    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(input()).toHaveValue("");
    expect(input()).toHaveFocus();
  });

  it("ignores other keys and arrow keys without results", async () => {
    setState({ data: [] });
    const user = userEvent.setup();
    render(<SearchBar />);
    await user.type(input(), "zz");
    expect(
      await screen.findByText("No posts match “zz”.", { selector: "div > p" }),
    ).toBeInTheDocument();
    await user.keyboard("{ArrowDown}{ArrowUp}{Shift}");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(input()).not.toHaveAttribute("aria-activedescendant");
  });

  it("explains when search fails", async () => {
    setState({ data: undefined, isError: true });
    const user = userEvent.setup();
    render(<SearchBar />);
    await user.type(input(), "zz");
    expect(
      await screen.findByText("Search is unavailable right now.", {
        selector: "div > p",
      }),
    ).toHaveClass("text-red-600");
  });
});
