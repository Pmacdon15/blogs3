import type { CODE_LANGUAGES } from "@/lib/schemas";

export type CodeLanguage = (typeof CODE_LANGUAGES)[number];

export const CODE_THEMES = [
  "midnight",
  "dracula",
  "catppuccin",
  "aurora",
] as const;

export type CodeTheme = (typeof CODE_THEMES)[number];

export const DEFAULT_CODE_THEME: CodeTheme = "midnight";

export type TokenType =
  | "plain"
  | "keyword"
  | "string"
  | "comment"
  | "number"
  | "function"
  | "type"
  | "operator"
  | "property";

export type CodeToken = {
  type: TokenType;
  value: string;
  offset: number;
};

export type CodeThemePalette = {
  label: string;
  dot: string;
  wrapper: string;
  header: string;
  badge: string;
  pillActive: string;
  pillIdle: string;
  tokens: Record<TokenType, string>;
};

export const CODE_THEME_STYLES: Record<CodeTheme, CodeThemePalette> = {
  midnight: {
    label: "Midnight",
    dot: "bg-indigo-400",
    wrapper: "border-indigo-500/25 bg-[#0b1021] text-slate-100",
    header: "border-white/10 bg-[#111830] text-indigo-200",
    badge: "border-indigo-400/30 bg-indigo-500/20 text-indigo-200",
    pillActive: "bg-indigo-500/30 text-white ring-1 ring-indigo-400/50",
    pillIdle: "text-indigo-200/75 hover:bg-white/10 hover:text-white",
    tokens: {
      plain: "text-slate-100",
      keyword: "font-medium text-violet-400",
      string: "text-emerald-300",
      comment: "italic text-slate-400",
      number: "text-amber-300",
      function: "text-sky-300",
      type: "text-cyan-300",
      operator: "text-pink-400",
      property: "text-rose-300",
    },
  },
  dracula: {
    label: "Dracula",
    dot: "bg-pink-400",
    wrapper: "border-purple-500/30 bg-[#1e1f29] text-[#f8f8f2]",
    header: "border-purple-400/15 bg-[#282a36] text-purple-200",
    badge: "border-pink-400/30 bg-pink-500/20 text-pink-200",
    pillActive: "bg-pink-500/30 text-white ring-1 ring-pink-400/50",
    pillIdle: "text-purple-200/75 hover:bg-white/10 hover:text-white",
    tokens: {
      plain: "text-[#f8f8f2]",
      keyword: "font-medium text-pink-400",
      string: "text-yellow-200",
      comment: "italic text-indigo-300/70",
      number: "text-purple-300",
      function: "text-emerald-300",
      type: "italic text-cyan-300",
      operator: "text-pink-400",
      property: "text-orange-300",
    },
  },
  catppuccin: {
    label: "Catppuccin",
    dot: "bg-rose-300",
    wrapper: "border-rose-400/25 bg-[#1e1e2e] text-[#cdd6f4]",
    header: "border-white/10 bg-[#181825] text-rose-200",
    badge: "border-rose-400/30 bg-rose-500/20 text-rose-200",
    pillActive: "bg-rose-500/30 text-white ring-1 ring-rose-300/50",
    pillIdle: "text-rose-200/75 hover:bg-white/10 hover:text-white",
    tokens: {
      plain: "text-[#cdd6f4]",
      keyword: "font-medium text-purple-300",
      string: "text-lime-300",
      comment: "italic text-slate-400",
      number: "text-orange-300",
      function: "text-blue-300",
      type: "text-amber-200",
      operator: "text-teal-300",
      property: "text-rose-300",
    },
  },
  aurora: {
    label: "Aurora",
    dot: "bg-teal-300",
    wrapper: "border-teal-500/30 bg-[#071a1e] text-teal-50",
    header: "border-teal-400/15 bg-[#0c262c] text-teal-200",
    badge: "border-teal-400/30 bg-teal-500/20 text-teal-200",
    pillActive: "bg-teal-500/30 text-white ring-1 ring-teal-300/50",
    pillIdle: "text-teal-200/75 hover:bg-white/10 hover:text-white",
    tokens: {
      plain: "text-teal-50",
      keyword: "font-medium text-cyan-300",
      string: "text-lime-300",
      comment: "italic text-teal-400/70",
      number: "text-amber-300",
      function: "text-emerald-300",
      type: "text-sky-300",
      operator: "text-rose-400",
      property: "text-orange-300",
    },
  },
};

export type CodeSnippetPreset = {
  id: string;
  label: string;
  language: CodeLanguage;
  theme: CodeTheme;
  code: string;
};

/** Ready-made colorful starter snippets to pick from in the editor. */
export const CODE_SNIPPET_PRESETS: readonly CodeSnippetPreset[] = [
  {
    id: "ts-fetch",
    label: "TypeScript fetch",
    language: "typescript",
    theme: "midnight",
    code: `// Fetch typed JSON with automatic timeout
export async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(\`HTTP \${response.status}\`);
  }
  return response.json() as Promise<T>;
}`,
  },
  {
    id: "tsx-card",
    label: "React component",
    language: "tsx",
    theme: "dracula",
    code: `type BadgeProps = { label: string; count: number };

export function CounterBadge({ label, count }: BadgeProps) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full px-3 py-1">
      <span>{label}</span>
      <strong>{count}</strong>
    </div>
  );
}`,
  },
  {
    id: "py-pipeline",
    label: "Python pipeline",
    language: "python",
    theme: "catppuccin",
    code: `# Summarize published article word counts
from dataclasses import dataclass

@dataclass
class Article:
    slug: str
    words: int

def reading_minutes(articles: list[Article]) -> dict[str, int]:
    return {item.slug: max(1, item.words // 230) for item in articles}`,
  },
  {
    id: "rust-match",
    label: "Rust pattern match",
    language: "rust",
    theme: "aurora",
    code: `// Parse a status code into a human label
pub enum Status {
    Draft,
    Published(u32),
}

pub fn describe(status: &Status) -> String {
    match status {
        Status::Draft => String::from("draft"),
        Status::Published(views) => format!("live ({views} views)"),
    }
}`,
  },
  {
    id: "sql-query",
    label: "SQL analytics",
    language: "sql",
    theme: "midnight",
    code: `-- Top published tags by post count
SELECT
  LOWER(tag) AS tag_name,
  COUNT(*) AS total_posts
FROM posts, UNNEST(tags) AS tag
WHERE status = 'published'
GROUP BY tag_name
ORDER BY total_posts DESC
LIMIT 5;`,
  },
  {
    id: "bash-deploy",
    label: "Bash script",
    language: "bash",
    theme: "dracula",
    code: `# Run quality checks before deploying
set -euo pipefail

echo "Running checks..."
bun run lint --write
bun run typecheck
bun run test`,
  },
] as const;

const KEYWORDS = new Set([
  "as",
  "async",
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "count",
  "create",
  "def",
  "default",
  "delete",
  "desc",
  "do",
  "echo",
  "elif",
  "else",
  "enum",
  "export",
  "extends",
  "false",
  "fi",
  "final",
  "finally",
  "fn",
  "for",
  "from",
  "func",
  "function",
  "group",
  "if",
  "impl",
  "import",
  "in",
  "insert",
  "interface",
  "into",
  "is",
  "join",
  "let",
  "limit",
  "lower",
  "match",
  "mod",
  "mut",
  "new",
  "nil",
  "none",
  "not",
  "null",
  "or",
  "order",
  "package",
  "pub",
  "return",
  "select",
  "self",
  "set",
  "static",
  "struct",
  "switch",
  "then",
  "throw",
  "trait",
  "true",
  "try",
  "type",
  "typeof",
  "undefined",
  "unnest",
  "update",
  "use",
  "var",
  "where",
  "while",
  "with",
  "yield",
]);

const TOKEN_PATTERN =
  /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->|(?:#|--(?=\s))[^\n]*)|("(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|`(?:\\[\s\S]|[^`\\])*`)|(<\/?[A-Za-z][\w.-]*|--[A-Za-z][\w-]*|\b[A-Za-z_][\w-]*(?=\s*:))|\b(0x[0-9a-fA-F]+|\d+(?:\.\d+)?)\b|\b([A-Za-z_]\w*)\b|(=>|===|!==|==|!=|<=|>=|->|::|\+\+|--|[+\-*/%=<>!&|?:~^]+)/g;

function classifyWord(word: string, nextChar: string | undefined): TokenType {
  if (KEYWORDS.has(word.toLowerCase())) {
    return "keyword";
  }
  if (/^[A-Z]/.test(word)) {
    return "type";
  }
  if (nextChar === "(") {
    return "function";
  }
  return "plain";
}

/**
 * Splits a code snippet into syntax tokens for colorful rendering.
 * Every token is rendered as React text, never raw HTML.
 */
export function highlightCode(
  code: string,
  language: CodeLanguage,
): CodeToken[] {
  if (!code) return [];
  if (language === "plaintext") {
    return [{ type: "plain", value: code, offset: 0 }];
  }

  const tokens: CodeToken[] = [];
  let cursor = 0;

  for (const match of code.matchAll(TOKEN_PATTERN)) {
    const index = match.index;
    if (index > cursor) {
      tokens.push({
        type: "plain",
        value: code.slice(cursor, index),
        offset: cursor,
      });
    }

    const [full, comment, str, prop, num, word] = match;
    let type: TokenType;
    if (comment) {
      type = "comment";
    } else if (str) {
      type = "string";
    } else if (prop) {
      type = "property";
    } else if (num) {
      type = "number";
    } else if (word) {
      type = classifyWord(word, code[index + full.length]);
    } else {
      type = "operator";
    }

    tokens.push({ type, value: full, offset: index });
    cursor = index + full.length;
  }

  if (cursor < code.length) {
    tokens.push({
      type: "plain",
      value: code.slice(cursor),
      offset: cursor,
    });
  }

  return tokens;
}
