import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as authServer from "@/app/.well-known/oauth-authorization-server/[[...path]]/route";
import * as protectedResource from "@/app/.well-known/oauth-protected-resource/[[...resource]]/route";
import * as openid from "@/app/.well-known/openid-configuration/[[...path]]/route";
import { clerkIssuer, configuredIssuer } from "@/mcp/oauth-metadata";

// pk_test_ + base64("clerk.blog.example.com$")
const KEY = `pk_test_${btoa("clerk.blog.example.com$").replace(/=+$/, "")}`;
const ISSUER = "https://clerk.blog.example.com";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Clerk issuer", () => {
  it("decodes the Frontend API host from the publishable key", () => {
    expect(clerkIssuer(KEY)).toBe(ISSUER);
    expect(clerkIssuer(KEY.replace("pk_test_", "pk_live_"))).toBe(ISSUER);
    // "a?>.example.com$" contains byte values that produce "+" and "/" in base64;
    // rejects non-hostname characters, while valid hosts via URL-safe base64 work.
    const urlSafe = `pk_test_${btoa("a?>.example.com$").replace(/\+/g, "-").replace(/\//g, "_")}`;
    expect(clerkIssuer(urlSafe)).toBeNull();
    expect(clerkIssuer(`pk_test_${btoa("bad..example.com$")}`)).toBeNull();
    expect(clerkIssuer("pk_test_!!!")).toBeNull();
  });

  it("is null without a publishable key", () => {
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "");
    expect(configuredIssuer()).toBeNull();
  });
});

describe("/.well-known/oauth-protected-resource", () => {
  it("points MCP clients at Clerk for /api/mcp", async () => {
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", KEY);
    const res = protectedResource.GET(
      new Request(
        "https://blog.example.com/.well-known/oauth-protected-resource/api/mcp",
      ),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    await expect(res.json()).resolves.toEqual({
      resource: "https://blog.example.com/api/mcp",
      authorization_servers: [ISSUER],
      scopes_supported: ["profile", "email", "offline_access"],
      bearer_methods_supported: ["header"],
      resource_name: "Blogs",
      resource_documentation: "https://blog.example.com/admin/mcp",
    });
  });

  it("answers 503 when sign-in isn't configured", () => {
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "");
    const res = protectedResource.GET(new Request("https://blog.example.com"));
    expect(res.status).toBe(503);
  });

  it("answers the CORS preflight", () => {
    const res = protectedResource.OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Methods")).toBe(
      "GET, OPTIONS",
    );
  });
});

describe.each([
  ["oauth-authorization-server", authServer],
  ["openid-configuration", openid],
] as const)("/.well-known/%s", (document, route) => {
  it("copies Clerk's document", async () => {
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", KEY);
    const fetchMock = vi.fn(async () =>
      Response.json({
        issuer: ISSUER,
        token_endpoint: `${ISSUER}/oauth/token`,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const res = await route.GET();
    expect(fetchMock).toHaveBeenCalledWith(
      `${ISSUER}/.well-known/${document}`,
      expect.objectContaining({
        redirect: "error",
        headers: { accept: "application/json" },
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("max-age=3600");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    await expect(res.json()).resolves.toMatchObject({ issuer: ISSUER });
  });

  it("answers 502 when Clerk fails", async () => {
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", KEY);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("no", { status: 500 })),
    );
    expect((await route.GET()).status).toBe(502);
  });

  it("answers 503 when sign-in isn't configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "");
    expect((await route.GET()).status).toBe(503);
  });

  it("answers the CORS preflight", () => {
    expect(route.OPTIONS().status).toBe(204);
  });
});
