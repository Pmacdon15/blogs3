"use client";

import {
  ExternalLink,
  FilePlus2,
  FileText,
  Menu,
  PlugZap,
  X,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";
import { AuthButtons } from "@/components/auth-buttons";
import { cn } from "@/lib/cn";

type NavItem = {
  href: Route;
  label: string;
  icon: typeof FileText;
  /** Whether this item is the current section for `pathname`. */
  matches: (pathname: string) => boolean;
};

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/admin",
    label: "Posts",
    icon: FileText,
    matches: (path) =>
      path === "/admin" ||
      (path.startsWith("/admin/posts/") && path !== "/admin/posts/new"),
  },
  {
    href: "/admin/posts/new",
    label: "New post",
    icon: FilePlus2,
    matches: (path) => path === "/admin/posts/new",
  },
  {
    href: "/admin/mcp" as Route,
    label: "MCP connect",
    icon: PlugZap,
    matches: (path) => path.startsWith("/admin/mcp"),
  },
];

/*
 * The studio's navy sidebar. On small screens it collapses into a top bar
 * with a menu button. Reads nothing on the server: the current page comes
 * from usePathname (inside Suspense, so the shell stays static) and the
 * user menu is client-only.
 */
export function AdminSidebar() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <aside className="sticky top-0 z-30 flex flex-col bg-brand-950 text-brand-100 lg:h-dvh">
      <div className="flex h-14 items-center justify-between gap-3 px-4 lg:h-16 lg:px-5">
        <Link
          className="inline-flex items-center gap-2 font-semibold text-white tracking-tight"
          href="/admin"
          onClick={close}
        >
          <span
            aria-hidden="true"
            className="inline-flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 font-bold text-sm text-white"
          >
            B
          </span>
          Blogs3
          <span className="rounded bg-white/10 px-1.5 py-0.5 font-medium text-[10px] text-brand-200 uppercase tracking-wider">
            Studio
          </span>
        </Link>
        <button
          aria-controls="admin-nav"
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          className="inline-flex size-9 items-center justify-center rounded-lg text-brand-200 hover:bg-white/10 hover:text-white lg:hidden"
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          {open ? (
            <X aria-hidden="true" className="size-5" />
          ) : (
            <Menu aria-hidden="true" className="size-5" />
          )}
        </button>
      </div>

      <div
        className={cn(
          "flex-1 flex-col gap-4 border-white/10 border-t px-3 pt-3 pb-4 lg:flex lg:border-t-0",
          open ? "flex" : "hidden",
        )}
        id="admin-nav"
      >
        <nav aria-label="Studio" className="flex flex-col gap-0.5">
          <Suspense fallback={<NavLinks onNavigate={close} />}>
            <CurrentNavLinks onNavigate={close} />
          </Suspense>
          <Link
            className="mt-2 flex items-center gap-2.5 rounded-lg px-3 py-2 text-brand-300 text-sm hover:bg-white/5 hover:text-white"
            href={"/" as Route}
            onClick={close}
          >
            <ExternalLink aria-hidden="true" className="size-4" />
            View site
          </Link>
        </nav>
        <div className="mt-auto flex items-center gap-3 border-white/10 border-t px-2 pt-4">
          <AuthButtons showAdminLink={false} />
        </div>
      </div>
    </aside>
  );
}

function CurrentNavLinks({ onNavigate }: { onNavigate: () => void }) {
  return <NavLinks onNavigate={onNavigate} pathname={usePathname()} />;
}

export function NavLinks({
  pathname,
  onNavigate,
}: {
  pathname?: string;
  onNavigate: () => void;
}) {
  return (
    <>
      {NAV_ITEMS.map((item) => {
        const active = pathname ? item.matches(pathname) : false;
        const Icon = item.icon;
        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 font-medium text-sm transition-colors",
              active
                ? "bg-white/10 text-white"
                : "text-brand-200 hover:bg-white/5 hover:text-white",
            )}
            href={item.href}
            key={item.href}
            onClick={onNavigate}
          >
            <Icon aria-hidden="true" className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
