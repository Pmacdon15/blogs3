import { describe, expect, it } from "vitest";
import {
  countWords,
  formatReadingTime,
  readingMinutes,
  WORDS_PER_MINUTE,
} from "@/lib/reading-time";
import type { Block } from "@/lib/schemas";

const words = (n: number) => Array.from({ length: n }, () => "word").join(" ");

describe("countWords", () => {
  it("counts words split by any whitespace", () => {
    expect(countWords("  one two\n\nthree\tfour ")).toBe(4);
    expect(countWords("")).toBe(0);
  });
});

describe("readingMinutes", () => {
  it("is at least one minute, even for an empty post", () => {
    expect(readingMinutes([])).toBe(1);
  });

  it("counts headings, text, code and captions, rounding up", () => {
    const blocks: Block[] = [
      { id: "h", type: "heading", text: words(10) },
      { id: "t", type: "text", text: words(WORDS_PER_MINUTE) },
      { id: "c", type: "code", language: "bash", code: words(5) },
      {
        id: "i",
        type: "image",
        url: "https://example.com/a.png",
        alt: "alt words are not read",
        caption: words(5),
      },
      { id: "j", type: "image", url: "https://example.com/b.png", alt: "" },
    ];
    expect(readingMinutes(blocks)).toBe(2);
  });

  it("is exactly one minute at the reading speed", () => {
    expect(
      readingMinutes([
        { id: "t", type: "text", text: words(WORDS_PER_MINUTE) },
      ]),
    ).toBe(1);
  });
});

describe("formatReadingTime", () => {
  it("labels minutes", () => {
    expect(formatReadingTime(4)).toBe("4 min read");
  });
});
