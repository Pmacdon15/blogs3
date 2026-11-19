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

import RootLayout, { metadata, viewport } from "@/app/layout";

describe("RootLayout", () => {
  it("wraps every page in the fonts and client providers", () => {
    const html = renderToStaticMarkup(
      <RootLayout>
        <p>page body</p>
      </RootLayout>,
    );
    const doc = new DOMParser().parseFromString(html, "text/html");
    expect(doc.documentElement.getAttribute("lang")).toBe("en");
    expect(doc.documentElement.className).toBe("inter-var mono-var");
    expect(doc.body.className).toContain("bg-canvas");
    expect(doc.querySelector('[data-testid="providers"]')?.textContent).toBe(
      "page body",
    );
  });

  it("describes the site", () => {
    expect(metadata).toEqual({
      title: { default: "Blogs3", template: "%s · Blogs3" },
      description: "Notes, guides and ideas.",
    });
    expect(viewport).toEqual({ themeColor: "#2563eb" });
  });
});
