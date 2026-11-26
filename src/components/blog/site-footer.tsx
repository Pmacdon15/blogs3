import Link from "next/link";
import { Logo } from "@/components/blog/logo";

/** The public footer, with a quiet link to the editor. */
export function SiteFooter() {
  return (
    <footer className="mt-24 border-line border-t bg-surface">
      <div className="container-page flex flex-col gap-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <Logo />
          <p className="text-muted text-sm">Notes, guides and ideas.</p>
        </div>
        <nav aria-label="Footer">
          <ul className="flex items-center gap-4 text-muted text-sm">
            <li>
              <Link className="hover:text-brand-700" href="/">
                All posts
              </Link>
            </li>
            <li>
              <Link className="hover:text-brand-700" href="/about">
                About
              </Link>
            </li>
            <li>
              <Link className="hover:text-brand-700" href="/admin">
                Admin
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
