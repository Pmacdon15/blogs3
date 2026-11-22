import type { NextConfig } from "next";

/*
 * A baseline Content-Security-Policy that needs no nonces. A nonce-based
 * script-src would force every page to render per request, which breaks the
 * Cache Components static shell, and Next.js and Clerk both inject inline
 * scripts. So this only sets directives that don't touch scripts or styles:
 * no framing, no plugins, no <base> hijacking, forms post only to this origin
 * (server actions do; Clerk's components use fetch and redirects, not form
 * posts), and http subresources are upgraded to https.
 */
const contentSecurityPolicy = [
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  reactCompiler: true,
  typedRoutes: true,
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    useOffline: true,
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
          // Keeps window.opener for popups this site opens (Clerk OAuth).
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
