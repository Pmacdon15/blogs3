"use client";

import { FileText, LoaderCircle, Search, X } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { MIN_SEARCH_LENGTH, usePostSearch } from "@/hooks/use-post-search";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format-date";

export const SEARCH_DEBOUNCE_MS = 250;

export function useDebouncedValue<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** What the listbox says (and the live region announces) about the search. */
export function statusText({
  ready,
  isError,
  hasData,
  count,
  query,
}: {
  ready: boolean;
  isError: boolean;
  hasData: boolean;
  count: number;
  query: string;
}) {
  if (!ready || (!hasData && !isError)) return "Searching…";
  if (isError) return "Search is unavailable right now.";
  if (count === 0) return `No posts match “${query}”.`;
  return `${count} ${count === 1 ? "result" : "results"}`;
}

const resultHref = (slug: string) => `/blog/${slug}` as Route;

/*
 * Search as you type. An ARIA combobox: the input owns a listbox of results,
 * ↑/↓ move the active option, Enter opens it, Esc closes the list (or clears
 * the input when the list is already closed).
 */
export function SearchBar() {
  const router = useRouter();
  const id = useId();
  const listId = `${id}-results`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const query = useDebouncedValue(value.trim(), SEARCH_DEBOUNCE_MS);
  const ready = query.length >= MIN_SEARCH_LENGTH;
  const search = usePostSearch(query);
  const results = ready && search.data ? search.data : [];
  const active = activeIndex < results.length ? activeIndex : -1;
  const typing = value.trim() !== query;
  const showList = open && value.trim().length >= MIN_SEARCH_LENGTH;
  const loading =
    value.trim().length >= MIN_SEARCH_LENGTH && (typing || search.isFetching);

  const status = statusText({
    ready,
    isError: search.isError,
    hasData: Boolean(search.data),
    count: results.length,
    query,
  });

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setOpen(true);
        if (results.length > 0) setActiveIndex((active + 1) % results.length);
        break;
      case "ArrowUp":
        event.preventDefault();
        setOpen(true);
        if (results.length > 0)
          setActiveIndex(active <= 0 ? results.length - 1 : active - 1);
        break;
      case "Enter": {
        const target = results[active];
        if (showList && target) {
          event.preventDefault();
          setOpen(false);
          router.push(resultHref(target.slug));
        }
        break;
      }
      case "Escape":
        event.preventDefault();
        if (showList) setOpen(false);
        else setValue("");
        setActiveIndex(-1);
        break;
    }
  }

  return (
    <search className="relative w-full">
      <label className="sr-only" htmlFor={`${id}-input`}>
        Search posts
      </label>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-4 z-10 size-5 -translate-y-1/2 text-brand-500"
        />
        <input
          aria-activedescendant={
            showList && active >= 0 ? `${id}-option-${active}` : undefined
          }
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={showList}
          autoComplete="off"
          className="h-14 w-full rounded-2xl border border-line bg-white/90 pr-12 pl-12 text-base text-ink shadow-(--shadow-card) outline-none backdrop-blur transition placeholder:text-muted focus:border-brand-500 focus:shadow-(--shadow-lift) focus:ring-4 focus:ring-brand-500/25"
          id={`${id}-input`}
          onBlur={() => setOpen(false)}
          onChange={(event) => {
            setValue(event.target.value);
            setActiveIndex(-1);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search posts by title, excerpt or tag…"
          ref={inputRef}
          role="combobox"
          spellCheck={false}
          type="text"
          value={value}
        />
        <span className="absolute top-1/2 right-3 flex -translate-y-1/2 items-center">
          {loading ? (
            <LoaderCircle
              aria-hidden="true"
              className="size-5 animate-spin text-brand-500"
              data-testid="search-spinner"
            />
          ) : value ? (
            <button
              aria-label="Clear search"
              className="grid size-8 place-items-center rounded-lg text-muted hover:bg-brand-50 hover:text-brand-700"
              onClick={() => {
                setValue("");
                setActiveIndex(-1);
                inputRef.current?.focus();
              }}
              type="button"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          ) : null}
        </span>
      </div>

      <p aria-live="polite" className="sr-only" role="status">
        {showList ? status : ""}
      </p>

      <div
        className={cn(
          "absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-line bg-white text-left shadow-(--shadow-lift)",
          !showList && "hidden",
        )}
      >
        <div
          aria-label="Search results"
          id={listId}
          onMouseDown={(event) => event.preventDefault()}
          role="listbox"
          tabIndex={-1}
        >
          {results.map((post, index) => (
            // Each option is the link itself: an option can't hold an
            // interactive child, and a real link still opens in a new tab.
            <Link
              aria-selected={index === active}
              className={cn(
                "flex items-start gap-3 border-line border-b px-4 py-3 last:border-b-0 hover:bg-brand-50",
                index === active && "bg-brand-50",
              )}
              href={resultHref(post.slug)}
              id={`${id}-option-${index}`}
              key={post.id}
              onClick={() => setOpen(false)}
              onMouseEnter={() => setActiveIndex(index)}
              role="option"
              tabIndex={-1}
            >
              <FileText
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-brand-500"
              />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate font-medium text-ink">
                  {post.title}
                </span>
                <span className="truncate text-muted text-xs">
                  {post.publishedAt ? formatDate(post.publishedAt) : null}
                  {post.publishedAt && post.excerpt ? " · " : null}
                  {post.excerpt}
                </span>
              </span>
            </Link>
          ))}
        </div>
        {results.length === 0 ? (
          <p
            className={cn(
              "px-4 py-4 text-sm",
              search.isError ? "text-red-600" : "text-muted",
            )}
          >
            {status}
          </p>
        ) : null}
      </div>
    </search>
  );
}
