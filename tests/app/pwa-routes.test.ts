import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  renderBrandIcon: vi.fn(
    (
      size: { width: number; height: number },
      options?: { maskable?: boolean },
    ) =>
      new Response(JSON.stringify({ size, options }), {
        headers: { "content-type": "image/png" },
      }),
  ),
}));

vi.mock("@/lib/pwa-icon", () => ({
  renderBrandIcon: mocks.renderBrandIcon,
}));

import AppleIcon, {
  contentType as appleContentType,
  size as appleSize,
} from "@/app/apple-icon";
import Icon, { generateImageMetadata } from "@/app/icon";
import manifest from "@/app/manifest";
import {
  SITE_BACKGROUND_COLOR,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_THEME_COLOR,
} from "@/lib/seo";

describe("PWA metadata routes", () => {
  describe("web app manifest (/manifest.webmanifest)", () => {
    it("declares installable standalone PWA metadata, icons and shortcuts", () => {
      const data = manifest();
      expect(data).toEqual({
        id: "/",
        name: SITE_NAME,
        short_name: SITE_NAME,
        description: SITE_DESCRIPTION,
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "any",
        background_color: SITE_BACKGROUND_COLOR,
        theme_color: SITE_THEME_COLOR,
        categories: ["books", "education", "news", "productivity"],
        icons: [
          {
            src: "/icon/32",
            sizes: "32x32",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon/192",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon/512",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon/maskable-512",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
        shortcuts: [
          {
            name: "Latest posts",
            short_name: "Posts",
            description: "Browse the latest published posts",
            url: "/",
            icons: [{ src: "/icon/192", sizes: "192x192", type: "image/png" }],
          },
          {
            name: "Studio",
            short_name: "Studio",
            description: "Write and manage posts in the admin studio",
            url: "/admin",
            icons: [{ src: "/icon/192", sizes: "192x192", type: "image/png" }],
          },
        ],
      });
    });
  });

  describe("app icons (/icon/[id])", () => {
    it("advertises 32, 192, 512 and maskable-512 PNG variants", () => {
      expect(generateImageMetadata()).toEqual([
        {
          id: "32",
          size: { width: 32, height: 32 },
          contentType: "image/png",
        },
        {
          id: "192",
          size: { width: 192, height: 192 },
          contentType: "image/png",
        },
        {
          id: "512",
          size: { width: 512, height: 512 },
          contentType: "image/png",
        },
        {
          id: "maskable-512",
          size: { width: 512, height: 512 },
          contentType: "image/png",
        },
      ]);
    });

    it("renders each icon variant and falls back to 32x32 for unknown ids", async () => {
      await Icon({ id: Promise.resolve("192") });
      expect(mocks.renderBrandIcon).toHaveBeenLastCalledWith(
        { width: 192, height: 192 },
        { maskable: false },
      );

      await Icon({ id: Promise.resolve("maskable-512") });
      expect(mocks.renderBrandIcon).toHaveBeenLastCalledWith(
        { width: 512, height: 512 },
        { maskable: true },
      );

      await Icon({ id: Promise.resolve("unknown") });
      expect(mocks.renderBrandIcon).toHaveBeenLastCalledWith(
        { width: 32, height: 32 },
        { maskable: false },
      );
    });
  });

  describe("apple touch icon (/apple-icon)", () => {
    it("renders a 180x180 PNG brand icon", () => {
      expect(appleSize).toEqual({ width: 180, height: 180 });
      expect(appleContentType).toBe("image/png");
      AppleIcon();
      expect(mocks.renderBrandIcon).toHaveBeenCalledWith({
        width: 180,
        height: 180,
      });
    });
  });
});
