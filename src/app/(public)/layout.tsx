import { SiteFooter } from "@/components/blog/site-footer";
import { SiteHeader } from "@/components/blog/site-header";
import { SkipLink } from "@/components/skip-link";

/* The public frame. Reads nothing from the request, so pages keep their static shell. */
export default function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <SiteHeader />
      <main
        className="flex-1 scroll-mt-16 outline-none"
        id="main"
        tabIndex={-1}
      >
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
