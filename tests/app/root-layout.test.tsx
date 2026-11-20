import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Inter: (options: { variable: string }) => ({
    variable: "inter-var",
    options,
  }),
  JetBrains_Mono: () => ({ variable: "mono-var" }),
}));
vi.mock("@/components/providers", () => ({
  Providers: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="providers">{children}</div>
  ),
}));
vi.mock("@/components/offline-banner", () => ({
  OfflineBanner: () => <div data-testid="offline-banner" />,
}));
vi.mock("@/components/install-app-banner", () => ({
  InstallAppBanner: () => <div data-testid="install-app-banner" />,
}));

import RootLayout, { metadata, viewport } from "@/app/layout";

describe("RootLayout", () => {
  it("wraps every page in the fonts, offline banner, install banner and client providers", () => {
    const html = renderToStaticMarkup(
      <RootLayout>
        <p>page body</p>
      </RootLayout>,
    );
    const doc = new DOMParser().parseFromString(html, "text/html");
    expect(doc.documentElement.getAttribute("lang")).toBe("en");
    expect(doc.documentElement.className).toBe("inter-var mono-var");
    expect(doc.body.className).toContain("bg-canvas");
    expect(doc.querySelector('[data-testid="offline-banner"]')).not.toBeNull();
    expect(
      doc.querySelector('[data-testid="install-app-banner"]'),
    ).not.toBeNull();
    expect(doc.querySelector('[data-testid="providers"]')?.textContent).toBe(
      "page body",
    );
  });

  it("describes the site and PWA metadata", () => {
    expect(metadata).toMatchObject({
      metadataBase: expect.any(URL),
      applicationName: "Blogs",
      title: { default: "Blogs", template: "%s · Blogs" },
      description: "Notes, guides and ideas.",
      appleWebApp: {
        capable: true,
        title: "Blogs",
        statusBarStyle: "default",
      },
      formatDetection: {
        telephone: false,
      },
      openGraph: {
        type: "website",
        siteName: "Blogs",
        title: "Blogs",
        description: "Notes, guides and ideas.",
        locale: "en_US",
        url: "/",
      },
      twitter: {
        card: "summary_large_image",
        title: "Blogs",
        description: "Notes, guides and ideas.",
      },
      robots: {
        index: true,
        follow: true,
      },
    });
    expect(viewport).toEqual({ themeColor: "#2563eb" });
  });
});
