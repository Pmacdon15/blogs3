import type { MetadataRoute } from "next";
import {
  SITE_BACKGROUND_COLOR,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_THEME_COLOR,
} from "@/lib/seo";

/** Web App Manifest (`/manifest.webmanifest`) for PWA installation. */
export default function manifest(): MetadataRoute.Manifest {
  return {
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
  };
}
