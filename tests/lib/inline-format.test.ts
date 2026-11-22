import { describe, expect, it } from "vitest";
import {
  applyFormat,
  isSafeHref,
  parseInline,
  stripInline,
} from "@/lib/inline-format";

describe("parseInline", () => {
  it("returns plain text as one node", () => {
    expect(parseInline("Just text")).toEqual([
      { type: "text", key: 0, text: "Just text" },
    ]);
    expect(parseInline("")).toEqual([]);
  });

  it("parses bold, italic, code and links, keyed by offset", () => {
    expect(parseInline("a **b** *c* `d` [e](https://x.dev)")).toEqual([
      { type: "text", key: 0, text: "a " },
      {
        type: "strong",
        key: 2,
        children: [{ type: "text", key: 4, text: "b" }],
      },
      { type: "text", key: 7, text: " " },
      { type: "em", key: 8, children: [{ type: "text", key: 9, text: "c" }] },
      { type: "text", key: 11, text: " " },
      { type: "code", key: 12, text: "d" },
      { type: "text", key: 15, text: " " },
      {
        type: "link",
        key: 16,
        href: "https://x.dev",
        children: [{ type: "text", key: 17, text: "e" }],
      },
    ]);
  });

  it("nests formatting and keeps code literal", () => {
    const [bold] = parseInline("***both***");
    expect(bold).toMatchObject({
      type: "strong",
      children: [{ type: "em", children: [{ type: "text", text: "both" }] }],
    });
    expect(parseInline("`**not bold**`")).toEqual([
      { type: "code", key: 0, text: "**not bold**" },
    ]);
    expect(parseInline("[**go**](/blog/a)")[0]).toMatchObject({
      type: "link",
      href: "/blog/a",
      children: [{ type: "strong" }],
    });
  });

  it("leaves unsafe links, unclosed markers and line breaks as text", () => {
    expect(parseInline("2 * 3 * 4 ** 5 **")).toHaveLength(1);
    expect(parseInline("[x](javascript:alert(1)) **open *a\nb*")).toEqual([
      { type: "text", key: 0, text: "[x](javascript:alert(1)) **open *a\nb*" },
    ]);
  });
});

describe("isSafeHref", () => {
  it("allows web, mail, site and anchor links only", () => {
    for (const href of [
      "https://a.b",
      "HTTP://a.b",
      "mailto:a@b.c",
      "/p",
      "#s",
    ])
      expect(isSafeHref(href)).toBe(true);
    for (const href of ["javascript:x", "data:x", "//evil.com", "ftp://a"])
      expect(isSafeHref(href)).toBe(false);
  });
});

describe("stripInline", () => {
  it("drops the markers and link URLs", () => {
    expect(stripInline("**a** *b* `c` [d **e**](https://x) f")).toBe(
      "a b c d e f",
    );
  });
});

describe("applyFormat", () => {
  it("wraps the selection", () => {
    expect(applyFormat("say hi", 4, 6, "bold")).toEqual({
      value: "say **hi**",
      start: 6,
      end: 8,
    });
    expect(applyFormat("say hi", 4, 6, "italic").value).toBe("say *hi*");
    expect(applyFormat("say hi", 4, 6, "code").value).toBe("say `hi`");
  });

  it("inserts a selected placeholder for an empty selection", () => {
    expect(applyFormat("", 0, 0, "bold")).toEqual({
      value: "**bold text**",
      start: 2,
      end: 11,
    });
  });

  it("unwraps markers around the selection", () => {
    expect(applyFormat("say **hi**", 6, 8, "bold")).toEqual({
      value: "say hi",
      start: 4,
      end: 6,
    });
    expect(applyFormat("*hi*", 1, 3, "italic").value).toBe("hi");
    expect(applyFormat("***hi***", 3, 5, "italic").value).toBe("**hi**");
    expect(applyFormat("***hi***", 3, 5, "bold").value).toBe("*hi*");
    expect(applyFormat("`hi`", 1, 3, "code").value).toBe("hi");
  });

  it("does not mistake bold markers for italic", () => {
    expect(applyFormat("**hi**", 2, 4, "italic").value).toBe("***hi***");
  });

  it("unwraps markers inside the selection", () => {
    expect(applyFormat("say **hi**", 4, 10, "bold")).toEqual({
      value: "say hi",
      start: 4,
      end: 6,
    });
    expect(applyFormat("*hi*", 0, 4, "italic").value).toBe("hi");
  });

  it("wraps links and selects the URL", () => {
    expect(applyFormat("see docs", 4, 8, "link")).toEqual({
      value: "see [docs](https://)",
      start: 11,
      end: 19,
    });
    expect(applyFormat("", 0, 0, "link").value).toBe("[link text](https://)");
  });
});
