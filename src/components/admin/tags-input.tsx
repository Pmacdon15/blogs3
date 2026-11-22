"use client";

import { X } from "lucide-react";
import { useId, useState } from "react";
import { MAX_TAGS } from "@/lib/schemas";

/** Adds a tag the way the schema stores it (trimmed, lowercase, ≤ 32 chars), skipping duplicates. */
export function addTag(tags: string[], raw: string) {
  const tag = raw.trim().toLowerCase().slice(0, 32);
  if (!tag || tags.includes(tag) || tags.length >= MAX_TAGS) return tags;
  return [...tags, tag];
}

/** Tag chips: Enter or comma adds, Backspace on an empty field removes the last. */
export function TagsInput({
  value,
  onChange,
  error,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  error?: string;
}) {
  const inputId = useId();
  const hintId = useId();
  const [draft, setDraft] = useState("");
  const full = value.length >= MAX_TAGS;

  function commit(raw: string) {
    let next = value;
    for (const part of raw.split(",")) next = addTag(next, part);
    if (next !== value) onChange(next);
    setDraft("");
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="font-medium text-ink text-xs" htmlFor={inputId}>
        Tags
      </label>
      <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-1.5 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/25">
        {value.map((tag) => (
          <span
            className="inline-flex items-center gap-1 rounded-md bg-brand-50 py-0.5 pr-1 pl-2 font-medium text-brand-800 text-xs"
            key={tag}
          >
            {tag}
            <button
              aria-label={`Remove tag ${tag}`}
              className="-my-1 grid size-6 place-items-center rounded text-brand-700 hover:bg-brand-100 hover:text-brand-800"
              onClick={() => onChange(value.filter((t) => t !== tag))}
              type="button"
            >
              <X aria-hidden="true" className="size-3" />
            </button>
          </span>
        ))}
        <input
          aria-describedby={hintId}
          aria-invalid={error ? true : undefined}
          className="min-w-24 flex-1 bg-transparent py-0.5 text-sm outline-none placeholder:text-muted disabled:cursor-not-allowed"
          disabled={full}
          id={inputId}
          onBlur={() => commit(draft)}
          onChange={(event) => {
            const text = event.target.value;
            if (text.includes(",")) commit(text);
            else setDraft(text);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit(draft);
            } else if (event.key === "Backspace" && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          placeholder={full ? "" : "Add a tag…"}
          value={draft}
        />
      </div>
      <p className="text-muted text-xs" id={hintId}>
        {error ? (
          <span className="text-red-600">{error}</span>
        ) : (
          `${value.length}/${MAX_TAGS} · Enter or comma to add`
        )}
      </p>
    </div>
  );
}
