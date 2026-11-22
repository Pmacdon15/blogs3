import { act, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShareButtons } from "@/components/blog/share-buttons";

const URL = "https://example.com/blog/hello";
const TITLE = "Hello world";

describe("ShareButtons", () => {
  const writeText = vi.fn();
  const share = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
  });
  afterEach(() => {
    writeText.mockReset();
    share.mockReset();
    Reflect.deleteProperty(navigator, "share");
  });

  it("links to each network in a new tab, and email in place", () => {
    render(<ShareButtons title={TITLE} url={URL} />);
    expect(
      screen.getByRole("heading", { name: "Share this post" }),
    ).toBeInTheDocument();
    const x = screen.getByRole("link", { name: "Share on X" });
    expect(x).toHaveAttribute("target", "_blank");
    expect(x).toHaveAttribute("rel", "noopener noreferrer");
    expect(x.getAttribute("href")).toContain(encodeURIComponent(URL));
    for (const name of ["Bluesky", "LinkedIn", "Facebook"]) {
      expect(
        screen.getByRole("link", { name: `Share on ${name}` }),
      ).toHaveAttribute("target", "_blank");
    }
    const email = screen.getByRole("link", { name: "Share on Email" });
    expect(email).not.toHaveAttribute("target");
    expect(email.getAttribute("href")).toMatch(/^mailto:/);
  });

  it("copies the link and resets after a moment", async () => {
    writeText.mockResolvedValue(undefined);
    render(<ShareButtons title={TITLE} url={URL} />);
    const button = screen.getByRole("button", { name: "Copy link" });
    await act(async () => {
      fireEvent.click(button);
    });
    expect(writeText).toHaveBeenCalledWith(URL);
    expect(button).toHaveTextContent("Copied");
    expect(screen.getByRole("status")).toHaveTextContent("Link copied.");

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(button).toHaveTextContent("Copy link");
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("says when copying fails", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    render(<ShareButtons title={TITLE} url={URL} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy link" }));
    });
    expect(screen.getByRole("status")).toHaveTextContent("Couldn't copy");
  });

  it("hides the native share button where the browser has none", () => {
    render(<ShareButtons title={TITLE} url={URL} />);
    expect(screen.queryByRole("button", { name: "Share…" })).toBeNull();
  });

  it("opens the native share sheet and ignores a dismissal", async () => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: share,
    });
    share.mockResolvedValueOnce(undefined);
    share.mockRejectedValueOnce(new DOMException("cancel", "AbortError"));
    render(<ShareButtons title={TITLE} url={URL} />);
    const button = screen.getByRole("button", { name: "Share…" });
    await act(async () => {
      fireEvent.click(button);
    });
    await act(async () => {
      fireEvent.click(button);
    });
    expect(share).toHaveBeenCalledTimes(2);
    expect(share).toHaveBeenCalledWith({ title: TITLE, url: URL });
  });

  it("leaves out the native share button on the server", () => {
    const html = renderToString(<ShareButtons title={TITLE} url={URL} />);
    expect(html).toContain("Copy link");
    expect(html).not.toContain("Share…");
  });
});
