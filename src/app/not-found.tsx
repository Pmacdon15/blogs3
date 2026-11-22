import { Compass } from "lucide-react";
import Link from "next/link";
import { SiteFooter } from "@/components/blog/site-footer";
import { SiteHeader } from "@/components/blog/site-header";
import { SkipLink } from "@/components/skip-link";
import { buttonClasses } from "@/components/ui/button";

/* The 404 for any unknown URL, in the public frame. */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <SiteHeader />
      <main
        className="relative isolate flex flex-1 items-center overflow-hidden outline-none"
        id="main"
        tabIndex={-1}
      >
        <div
          aria-hidden="true"
          className="absolute top-0 left-1/2 -z-10 h-80 w-[40rem] -translate-x-1/2 rounded-full bg-brand-100/70 blur-3xl"
        />
        <div className="container-page flex flex-col items-center gap-5 py-24 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-white text-brand-600 shadow-(--shadow-card)">
            <Compass aria-hidden="true" className="size-7" />
          </span>
          <p className="bg-linear-to-r from-brand-500 to-brand-800 bg-clip-text font-semibold text-6xl text-transparent tracking-tight">
            404
          </p>
          <h1 className="font-semibold text-2xl text-ink tracking-tight sm:text-3xl">
            This page wandered off
          </h1>
          <p className="max-w-md text-muted">
            The link may be broken, or the page may have moved.
          </p>
          <Link className={buttonClasses("primary", "lg", "mt-2")} href="/">
            Back to the blog
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
