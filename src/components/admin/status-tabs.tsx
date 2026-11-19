import type { Route } from "next";
import Link from "next/link";
import type { StatusFilter } from "@/components/admin/post-rows";
import { cn } from "@/lib/cn";

const TABS: { filter: StatusFilter; label: string; href: Route }[] = [
  { filter: "all", label: "All", href: "/admin" },
  { filter: "draft", label: "Drafts", href: "/admin?status=draft" as Route },
  {
    filter: "published",
    label: "Published",
    href: "/admin?status=published" as Route,
  },
];

/** Status filter links. Without `active` (the static fallback) none is marked. */
export function StatusTabs({ active }: { active?: StatusFilter }) {
  return (
    <nav
      aria-label="Filter posts"
      className="flex gap-1 rounded-lg bg-brand-50 p-1"
    >
      {TABS.map((tab) => (
        <Link
          aria-current={tab.filter === active ? "page" : undefined}
          className={cn(
            "rounded-md px-3 py-1 font-medium text-sm transition-colors",
            tab.filter === active
              ? "bg-surface text-brand-800 shadow-sm"
              : "text-muted hover:text-brand-700",
          )}
          href={tab.href}
          key={tab.filter}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
