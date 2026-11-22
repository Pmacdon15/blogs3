/*
 * Inline formatting for text blocks, stored as a small Markdown subset in the
 * block's plain text: **bold**, *italic*, `code` and [label](url). The parser
 * returns a tree the renderer turns into React elements, so text is never
 * treated as HTML. The editor helpers wrap or unwrap a textarea selection.
 */

export type InlineNode =
  | { type: "text"; key: number; text: string }
  | { type: "code"; key: number; text: string }
  | { type: "strong" | "em"; key: number; children: InlineNode[] }
  | { type: "link"; key: number; href: string; children: InlineNode[] };

export type InlineFormat = "bold" | "italic" | "code" | "link";

/*
 * One token per alternative: code, bold (the lookahead lets `***x***` close
 * on the last pair), italic, link. None of them crosses a line break, and
 * bold/italic can't start or end with a space, so `2 * 3 * 4` stays text.
 */
const TOKEN =
  /`([^`\n]+)`|\*\*(?!\s)([^\n]+?)(?<!\s)\*\*(?!\*)|\*(?!\s)([^*\n]+)(?<!\s)\*|\[([^\]\n]+)\]\(([^)\s]+)\)/g;

/** Links may point at the web, an email address, a page on this site or an anchor. */
export function isSafeHref(href: string) {
  return /^(https?:|mailto:)/i.test(href) || /^\/(?!\/)|^#/.test(href);
}

export function parseInline(text: string, offset = 0): InlineNode[] {
  const nodes: InlineNode[] = [];
  let last = 0;
  const pushText = (from: number, to: number) => {
    if (to > from)
      nodes.push({
        type: "text",
        key: offset + from,
        text: text.slice(from, to),
      });
  };

  for (const match of text.matchAll(TOKEN)) {
    const [whole, code, bold, italic, label, href] = match;
    const start = match.index;
    const key = offset + start;
    let node: InlineNode;
    if (code !== undefined) {
      node = { type: "code", key, text: code };
    } else if (bold !== undefined) {
      node = { type: "strong", key, children: parseInline(bold, key + 2) };
    } else if (italic !== undefined) {
      node = { type: "em", key, children: parseInline(italic, key + 1) };
    } else if (isSafeHref(href)) {
      node = { type: "link", key, href, children: parseInline(label, key + 1) };
    } else {
      continue;
    }
    pushText(last, start);
    nodes.push(node);
    last = start + whole.length;
  }
  pushText(last, text.length);
  return nodes;
}

/** Text with the formatting markers removed (for counting words, previews…). */
export function stripInline(text: string): string {
  return stripNodes(parseInline(text));
}

function stripNodes(nodes: InlineNode[]): string {
  return nodes
    .map((node) =>
      node.type === "text" || node.type === "code"
        ? node.text
        : stripNodes(node.children),
    )
    .join("");
}

export type Edit = { value: string; start: number; end: number };

const MARKERS = { bold: "**", italic: "*", code: "`" } as const;
const PLACEHOLDERS = {
  bold: "bold text",
  italic: "italic text",
  code: "code",
  link: "link text",
} as const;
const LINK_URL = "https://";

/** How many `char`s run backwards from `index` (exclusive) / forwards from it. */
function runBefore(value: string, index: number, char: string) {
  let count = 0;
  while (value[index - count - 1] === char) count++;
  return count;
}
function runAfter(value: string, index: number, char: string) {
  let count = 0;
  while (value[index + count] === char) count++;
  return count;
}

/** Whether a run of `count` stars contains the given marker. */
function hasStars(count: number, format: "bold" | "italic" | "code") {
  if (format === "code") return count >= 1;
  return format === "bold" ? count >= 2 : count % 2 === 1;
}

/*
 * Applies a toolbar button to the selection [start, end): wraps it in the
 * format's markers, or removes them when the selection is already wrapped.
 * An empty selection inserts a placeholder and selects it. Links wrap the
 * selection as [label](https://) and select the URL so it can be typed.
 */
export function applyFormat(
  value: string,
  start: number,
  end: number,
  format: InlineFormat,
): Edit {
  const selected = value.slice(start, end);
  if (format === "link") {
    const label = selected || PLACEHOLDERS.link;
    const next = `${value.slice(0, start)}[${label}](${LINK_URL})${value.slice(end)}`;
    const urlStart = start + label.length + 3;
    return { value: next, start: urlStart, end: urlStart + LINK_URL.length };
  }

  const marker = MARKERS[format];
  const size = marker.length;
  const char = marker[0];

  // Markers just outside the selection: **|text|**
  if (
    hasStars(runBefore(value, start, char), format) &&
    hasStars(runAfter(value, end, char), format)
  ) {
    return {
      value: value.slice(0, start - size) + selected + value.slice(end + size),
      start: start - size,
      end: end - size,
    };
  }

  // Markers inside the selection: |**text**|
  if (
    selected.length >= size * 2 + 1 &&
    hasStars(runAfter(selected, 0, char), format) &&
    hasStars(runBefore(selected, selected.length, char), format)
  ) {
    const inner = selected.slice(size, -size);
    return {
      value: value.slice(0, start) + inner + value.slice(end),
      start,
      end: start + inner.length,
    };
  }

  const text = selected || PLACEHOLDERS[format];
  return {
    value: `${value.slice(0, start)}${marker}${text}${marker}${value.slice(end)}`,
    start: start + size,
    end: start + size + text.length,
  };
}

/** Keyboard shortcuts (with Ctrl or ⌘) for the formatting toolbar. */
export const FORMAT_SHORTCUTS: Record<string, InlineFormat> = {
  b: "bold",
  i: "italic",
  e: "code",
  k: "link",
};
