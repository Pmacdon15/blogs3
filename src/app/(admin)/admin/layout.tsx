import type { Metadata } from "next";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { SkipLink } from "@/components/skip-link";

export const metadata: Metadata = {
  title: { default: "Studio", template: "%s · Studio · Blogs" },
  robots: { index: false, follow: false },
};

/*
 * The "studio": a denser look than the public site, with a navy sidebar.
 * Reads no request data (no auth() here); each page checks the admin inside
 * its own Suspense holes.
 */
export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-dvh bg-canvas lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <SkipLink />
      <AdminSidebar />
      <main
        className="min-w-0 scroll-mt-14 px-4 py-6 outline-none sm:px-6 lg:scroll-mt-0 lg:px-10 lg:py-8"
        id="main"
        tabIndex={-1}
      >
        {children}
      </main>
    </div>
  );
}
