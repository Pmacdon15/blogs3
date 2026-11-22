import { describe, expect, it } from "vitest";
import { shareLinks } from "@/lib/share";

describe("shareLinks", () => {
  const url = "https://example.com/blog/a&b";
  const title = "Hello & welcome";
  const links = shareLinks(url, title);
  const href = (network: string) =>
    links.find((link) => link.network === network)?.href;

  it("lists every network in display order", () => {
    expect(links.map((link) => link.label)).toEqual([
      "X",
      "Bluesky",
      "LinkedIn",
      "Facebook",
      "Email",
    ]);
  });

  it("encodes the URL and title for each network", () => {
    const u = encodeURIComponent(url);
    const t = encodeURIComponent(title);
    expect(href("x")).toBe(`https://x.com/intent/post?text=${t}&url=${u}`);
    expect(href("bluesky")).toBe(
      `https://bsky.app/intent/compose?text=${encodeURIComponent(`${title} ${url}`)}`,
    );
    expect(href("linkedin")).toBe(
      `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
    );
    expect(href("facebook")).toBe(
      `https://www.facebook.com/sharer/sharer.php?u=${u}`,
    );
    expect(href("email")).toBe(`mailto:?subject=${t}&body=${u}`);
  });
});
