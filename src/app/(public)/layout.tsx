import { SiteFooter } from "@/components/blog/site-footer";
import { SiteHeader } from "@/components/blog/site-header";

/* The public frame. Reads nothing from the request, so pages keep their static shell. */
export default function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex-1" id="main">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
