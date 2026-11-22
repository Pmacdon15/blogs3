import Link from "next/link";

/** The "Blogs" wordmark with its gradient mark; links home ("Blogs home"). */
export function Logo() {
  return (
    <Link
      className="group inline-flex items-center gap-2.5 rounded-lg"
      href="/"
    >
      <span
        aria-hidden="true"
        className="grid size-8 place-items-center rounded-xl bg-linear-to-br from-brand-400 via-brand-600 to-brand-800 font-bold text-sm text-white shadow-(--shadow-card) transition group-hover:shadow-(--shadow-lift)"
      >
        B
      </span>
      <span className="font-semibold text-ink text-lg tracking-tight">
        {/* Starts with the visible text, so voice control can say "Blogs". */}
        Blogs <span className="sr-only">home</span>
      </span>
    </Link>
  );
}
