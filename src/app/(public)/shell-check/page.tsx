import type { Metadata } from "next";

/*
 * A canary for the static shell. `ensureStatic = "navigation"` makes
 * `next build` fail if anything in this route, including the root and public
 * layouts above it, reads request data (cookies, headers, the session,
 * uncached data) on the server. tests/build/static-shell.test.ts also checks
 * it builds fully static (○).
 */
export const ensureStatic = "navigation";

export const metadata: Metadata = {
  title: "Shell check",
  robots: { index: false, follow: false },
};

export default function ShellCheckPage() {
  return (
    <div className="container-page py-16">
      <h1 className="font-semibold text-3xl text-ink tracking-tight">
        Shell check
      </h1>
      <p className="mt-3 text-muted">
        This page is prerendered in full at build time.
      </p>
    </div>
  );
}
