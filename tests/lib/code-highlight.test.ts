import { describe, expect, it } from "vitest";
import {
  CODE_SNIPPET_PRESETS,
  CODE_THEME_STYLES,
  CODE_THEMES,
  DEFAULT_CODE_THEME,
  highlightCode,
} from "@/lib/code-highlight";

describe("code themes and presets", () => {
  it("defines colorful themes with Midnight as default", () => {
    expect(DEFAULT_CODE_THEME).toBe("midnight");
    for (const theme of CODE_THEMES) {
      expect(CODE_THEME_STYLES[theme].label).toBeTruthy();
      expect(CODE_THEME_STYLES[theme].tokens.keyword).toContain("text-");
    }
    expect(CODE_SNIPPET_PRESETS.length).toBeGreaterThanOrEqual(4);
  });
});

describe("highlightCode", () => {
  it("returns empty for empty code and a single plain token for plaintext", () => {
    expect(highlightCode("", "typescript")).toEqual([]);
    expect(highlightCode("const x = 1;", "plaintext")).toEqual([
      { type: "plain", value: "const x = 1;", offset: 0 },
    ]);
  });

  it("tokenizes comments, strings, properties, numbers, keywords, types, functions, operators and trailing text", () => {
    const snippet = [
      "// line comment",
      'const msg = "hi";',
      "type Box = { count: 42 };",
      "render(<Widget --flag />);",
    ].join("\n");

    const tokens = highlightCode(snippet, "tsx");
    const byType = (type: string) =>
      tokens.filter((t) => t.type === type).map((t) => t.value);

    expect(byType("comment")).toContain("// line comment");
    expect(byType("keyword")).toEqual(
      expect.arrayContaining(["const", "type"]),
    );
    expect(byType("string")).toContain('"hi"');
    expect(byType("property")).toEqual(
      expect.arrayContaining(["count", "<Widget", "--flag"]),
    );
    expect(byType("number")).toContain("42");
    expect(byType("type")).toContain("Box");
    expect(byType("function")).toContain("render");
    expect(byType("operator")).toContain("=");
    expect(tokens.map((t) => t.value).join("")).toBe(snippet);
  });
});
