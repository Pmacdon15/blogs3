/*
 * Dates render the same on the server, in the cache and in the browser: a
 * fixed locale and UTC, so a post never shows a different day after hydration.
 */
const dateFormat = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/** "2026-11-19T10:00:00.000Z" → "Nov 19, 2026". */
export function formatDate(iso: string) {
  return dateFormat.format(new Date(iso));
}
