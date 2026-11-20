"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import {
  CODE_THEME_STYLES,
  CODE_THEMES,
  type CodeLanguage,
  type CodeTheme,
  DEFAULT_CODE_THEME,
  highlightCode,
} from "@/lib/code-highlight";

export function HighlightedCode({
  code,
  language,
  theme = DEFAULT_CODE_THEME,
}: {
  code: string;
  language: CodeLanguage;
  theme?: CodeTheme;
}) {
  const palette = CODE_THEME_STYLES[theme];
  const tokens = highlightCode(code, language);

  return (
    <code className={palette.tokens.plain}>
      {tokens.map((token) =>
        token.type === "plain" ? (
          token.value
        ) : (
          <span
            className={palette.tokens[token.type]}
            data-token={token.type}
            key={token.offset}
          >
            {token.value}
          </span>
        ),
      )}
    </code>
  );
}

export function CodeSnippet({
  code,
  language,
  initialTheme = DEFAULT_CODE_THEME,
}: {
  code: string;
  language: CodeLanguage;
  initialTheme?: CodeTheme;
}) {
  const [theme, setTheme] = useState<CodeTheme>(initialTheme);
  const palette = CODE_THEME_STYLES[theme];

  return (
    <div
      className={cn(
        "not-prose my-6 overflow-hidden rounded-2xl border shadow-(--shadow-card) transition-colors",
        palette.wrapper,
      )}
      data-code-theme={theme}
    >
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2 font-mono text-xs",
          palette.header,
        )}
      >
        <div className="flex items-center gap-2.5">
          <span aria-hidden="true" className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-rose-400/85" />
            <span className="size-2.5 rounded-full bg-amber-400/85" />
            <span className="size-2.5 rounded-full bg-emerald-400/85" />
          </span>
          <span
            className={cn(
              "rounded-md border px-2 py-0.5 font-medium text-[11px]",
              palette.badge,
            )}
          >
            {language}
          </span>
        </div>
        <fieldset
          aria-label="Code color theme"
          className="m-0 flex min-w-0 flex-wrap items-center gap-1 border-0 p-0"
        >
          {CODE_THEMES.map((option) => {
            const optionPalette = CODE_THEME_STYLES[option];
            const active = option === theme;
            return (
              <button
                aria-pressed={active}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-sans text-[11px] transition-colors",
                  active ? palette.pillActive : palette.pillIdle,
                )}
                key={option}
                onClick={() => setTheme(option)}
                type="button"
              >
                <span
                  aria-hidden="true"
                  className={cn("size-2 rounded-full", optionPalette.dot)}
                />
                {optionPalette.label}
              </button>
            );
          })}
        </fieldset>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-sm leading-relaxed">
        <HighlightedCode code={code} language={language} theme={theme} />
      </pre>
    </div>
  );
}
