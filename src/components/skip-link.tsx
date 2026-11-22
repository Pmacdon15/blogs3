/*
 * The first thing a keyboard user reaches: jumps past the header or sidebar
 * to the page's <main id="main"> (WCAG 2.4.1). Hidden until focused.
 */
export function SkipLink() {
  return (
    <a
      className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:font-medium focus:text-brand-800 focus:text-sm focus:shadow-(--shadow-lift)"
      href="#main"
    >
      Skip to content
    </a>
  );
}
