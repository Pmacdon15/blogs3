// @vitest-environment node
import { describe, expect, test } from "vitest";
import nextConfig from "../../../next.config";

/*
 * Security headers sent on every response. The CSP deliberately has no
 * script-src or default-src: those would need per-request nonces, which break
 * the Cache Components static shell.
 */
async function globalHeaders() {
  const rules = (await nextConfig.headers?.()) ?? [];
  const rule = rules.find((r) => r.source === "/:path*");
  return Object.fromEntries(
    (rule?.headers ?? []).map(({ key, value }) => [key, value]),
  );
}

describe("next.config headers", () => {
  test("sends the baseline security headers on every path", async () => {
    expect(await globalHeaders()).toMatchObject({
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    });
  });

  test("sends a nonce-free Content-Security-Policy", async () => {
    const csp = (await globalHeaders())["Content-Security-Policy"];
    expect(csp?.split("; ")).toEqual([
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ]);
    expect(csp).not.toMatch(/script-src|default-src|nonce-/);
  });

  test("leaves HSTS preload to the owner", async () => {
    expect((await globalHeaders())["Strict-Transport-Security"]).not.toMatch(
      /preload/,
    );
  });
});
