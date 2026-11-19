import type { Metadata } from "next";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

export const metadata: Metadata = {
  title: { default: "Studio", template: "%s · Studio · Blogs3" },
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
      <AdminSidebar />
      <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        {children}
      </main>
    </div>
  );
}
