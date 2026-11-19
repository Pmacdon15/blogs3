import Link from "next/link";
import { Logo } from "@/components/blog/logo";

/*
 * The public header. Static: no session, no URL. The site has one author,
 * so there's no sign-in UI here; the editor lives at /admin.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-line/80 border-b bg-white/75 backdrop-blur-lg supports-[backdrop-filter]:bg-white/60">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Logo />
        <nav aria-label="Main">
          <ul className="flex items-center gap-1 text-sm">
            <li>
              <Link
                className="rounded-lg px-3 py-2 font-medium text-muted transition-colors hover:bg-brand-50 hover:text-brand-700"
                href="/"
              >
                Posts
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
