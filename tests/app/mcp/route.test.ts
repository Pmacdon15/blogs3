import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * /api/mcp end to end: the real route (mcp-handler + bearer auth) with Clerk
 * and the DAL mocked.
 */

const m = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  isAdmin: vi.fn(async () => true),
}));

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: async () => ({ authenticateRequest: m.authenticateRequest }),
}));
vi.mock("@/lib/dal/posts", () => ({}));
vi.mock("@/lib/dal/auth", () => ({ isAdmin: m.isAdmin }));
vi.mock("@/lib/cache/revalidate", () => ({ revalidatePostCaches: vi.fn() }));
vi.mock("@/db/posts", () => ({}));

import { DELETE, GET, OPTIONS, POST } from "@/app/api/mcp/route";

const URL_ = "https://blog.example.com/api/mcp";

const rpc = (
  body: unknown,
  headers: Record<string, string> = { authorization: "bearer oat_valid" },
) =>
  POST(
    new Request(URL_, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "mcp-protocol-version": "2025-06-18",
        ...headers,
      },
      body: JSON.stringify(body),
    }),
  );

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.stubEnv("MCP_ALLOWED_OAUTH_CLIENT_IDS", "");
  vi.stubEnv("MCP_TOKEN_AUDIENCE", "off");
  m.authenticateRequest.mockResolvedValue({
    toAuth: () => ({
      isAuthenticated: true,
      tokenType: "oauth_token",
      userId: "user_admin",
      clientId: "client_claude",
      scopes: ["profile"],
    }),
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("/api/mcp", () => {
  it("exports one handler for every method", () => {
    expect(GET).toBe(POST);
    expect(DELETE).toBe(POST);
    expect(OPTIONS).toBe(POST);
  });

  it("answers the CORS preflight", async () => {
    const res = await OPTIONS(new Request(URL_, { method: "OPTIONS" }));
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain(
      "Authorization",
    );
  });

  it("challenges a client without a token with the resource metadata URL", async () => {
    const res = await rpc({ jsonrpc: "2.0", id: 1, method: "ping" }, {});
    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toBe(
      'Bearer resource_metadata="https://blog.example.com/.well-known/oauth-protected-resource/api/mcp", scope="profile email offline_access"',
    );
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(m.authenticateRequest).not.toHaveBeenCalled();
  });

  it("rejects a token Clerk refuses", async () => {
    m.authenticateRequest.mockResolvedValue({
      reason: "token-invalid",
      toAuth: () => ({ isAuthenticated: false }),
    });
    const res = await rpc({ jsonrpc: "2.0", id: 1, method: "ping" });
    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toContain(
      'error="invalid_token"',
    );
  });

  it("rejects a token that isn't an OAuth token without calling Clerk", async () => {
    const res = await rpc(
      { jsonrpc: "2.0", id: 1, method: "ping" },
      { authorization: "Bearer junk" },
    );
    expect(res.status).toBe(401);
    expect(m.authenticateRequest).not.toHaveBeenCalled();
  });

  it("initializes and calls a tool for a JSON-only client", async () => {
    const init = await rpc({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "test", version: "1.0.0" },
      },
    });
    expect(init.status).toBe(200);
    expect(init.headers.get("content-type")).toContain("application/json");
    const body = (await init.json()) as {
      result: { serverInfo: { name: string }; instructions: string };
    };
    expect(body.result.serverInfo.name).toBe("blogs");
    expect(body.result.instructions).toMatch(/Blogs/);

    const res = await rpc({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "whoami", arguments: {} },
    });
    expect(res.status).toBe(200);
    const called = (await res.json()) as {
      result: { structuredContent: unknown };
    };
    expect(called.result.structuredContent).toEqual({
      userId: "user_admin",
      isAdmin: true,
    });
    expect(m.isAdmin).toHaveBeenCalledWith("user_admin");
  });
});
