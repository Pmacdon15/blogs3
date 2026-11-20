import type { AuthInfo } from "@modelcontextprotocol/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  bearerToken,
  callerLabel,
  MCP_CORS_HEADERS,
  MCP_SCOPES,
  mcpResourceUrl,
  mcpRoute,
  messagesFromEventStream,
  preflight,
  publicOrigin,
  resourceMetadataUrl,
  unauthorized,
  withCors,
} from "@/mcp/http";

const URL_ = "https://blog.example.com/api/mcp";
const authInfo: AuthInfo = {
  token: "oat_1",
  clientId: "client",
  scopes: [],
  extra: { userId: "user_1" },
};

const post = (headers: Record<string, string> = {}, body = "{}") =>
  new Request(URL_, {
    method: "POST",
    headers: { authorization: "Bearer oat_1", ...headers },
    body,
  });

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("origins and URLs", () => {
  it("uses the request's host outside production", () => {
    const req = new Request(URL_);
    expect(publicOrigin(req)).toBe("https://blog.example.com");
    expect(mcpResourceUrl(req)).toBe(URL_);
    expect(resourceMetadataUrl(req)).toBe(
      "https://blog.example.com/.well-known/oauth-protected-resource/api/mcp",
    );
  });

  it("always uses the production domain in production", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "https://blog.example.org/");
    const req = new Request("https://blogs-abc.vercel.app/api/mcp");
    expect(publicOrigin(req)).toBe("https://blog.example.org");
  });

  it("falls back to the request host in production without a domain", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    expect(publicOrigin(new Request(URL_))).toBe("https://blog.example.com");
  });
});

describe("bearerToken", () => {
  it("reads the token whatever the scheme's case", () => {
    for (const scheme of ["Bearer", "bearer", "BEARER"]) {
      const req = new Request(URL_, {
        headers: { authorization: `${scheme} oat_abc` },
      });
      expect(bearerToken(req)).toBe("oat_abc");
    }
  });

  it("ignores other schemes and missing headers", () => {
    expect(
      bearerToken(new Request(URL_, { headers: { authorization: "Basic x" } })),
    ).toBeUndefined();
    expect(bearerToken(new Request(URL_))).toBeUndefined();
  });
});

describe("CORS", () => {
  it("adds the CORS headers to any response", () => {
    const res = withCors(new Response("x", { status: 418, statusText: "Tea" }));
    expect(res.status).toBe(418);
    for (const [name, value] of Object.entries(MCP_CORS_HEADERS)) {
      expect(res.headers.get(name)).toBe(value);
    }
  });

  it("echoes requested headers in the preflight", () => {
    const res = preflight(
      new Request(URL_, {
        method: "OPTIONS",
        headers: { "access-control-request-headers": "x-custom" },
      }),
    );
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Headers")).toBe("x-custom");
    expect(res.headers.get("Vary")).toBe("Access-Control-Request-Headers");
  });

  it("ignores malformed or oversized requested headers in preflight", () => {
    const badChars = preflight(
      new Request(URL_, {
        method: "OPTIONS",
        headers: { "access-control-request-headers": "x-custom; evil=1" },
      }),
    );
    expect(badChars.headers.get("Access-Control-Allow-Headers")).toBe(
      MCP_CORS_HEADERS["Access-Control-Allow-Headers"],
    );
    expect(badChars.headers.get("Vary")).toBeNull();

    const oversized = preflight(
      new Request(URL_, {
        method: "OPTIONS",
        headers: { "access-control-request-headers": "x".repeat(513) },
      }),
    );
    expect(oversized.headers.get("Access-Control-Allow-Headers")).toBe(
      MCP_CORS_HEADERS["Access-Control-Allow-Headers"],
    );
    expect(oversized.headers.get("Vary")).toBeNull();
  });
});

describe("unauthorized", () => {
  it("sends a plain challenge when no token was sent", async () => {
    const res = unauthorized(new Request(URL_));
    expect(res.status).toBe(401);
    const header = res.headers.get("WWW-Authenticate");
    expect(header).toBe(
      `Bearer resource_metadata="https://blog.example.com/.well-known/oauth-protected-resource/api/mcp", scope="${MCP_SCOPES.join(" ")}"`,
    );
    await expect(res.json()).resolves.toMatchObject({ error: "unauthorized" });
  });

  it("names invalid_token, without quotes in the reason", async () => {
    const res = unauthorized(new Request(URL_), 'bad "token"\\');
    expect(res.headers.get("WWW-Authenticate")).toContain(
      'error="invalid_token", error_description="bad token"',
    );
    await expect(res.json()).resolves.toMatchObject({
      error: "invalid_token",
    });
  });
});

describe("messagesFromEventStream", () => {
  it("reads every data line of every event", () => {
    expect(
      messagesFromEventStream(
        'event: message\ndata: {"a":1}\n\ndata: {"b":\ndata: 2}\r\n\r\n: comment\n\n',
      ),
    ).toEqual([{ a: 1 }, { b: 2 }]);
  });
});

describe("callerLabel", () => {
  it("is the trimmed user agent, or a placeholder", () => {
    expect(
      callerLabel(new Request(URL_, { headers: { "user-agent": " A  B " } })),
    ).toBe("A B");
    expect(callerLabel(new Request(URL_))).toBe("no user agent");
  });
});

describe("mcpRoute", () => {
  const ok = () =>
    vi.fn(async (req: Request) => {
      void req;
      return Response.json({ jsonrpc: "2.0", id: 1, result: {} });
    });

  it("answers the preflight without auth", async () => {
    const handler = ok();
    const route = mcpRoute(handler, vi.fn());
    const res = await route(new Request(URL_, { method: "OPTIONS" }));
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(handler).not.toHaveBeenCalled();
  });

  it("challenges a request without a token, with CORS", async () => {
    const verify = vi.fn();
    const route = mcpRoute(ok(), verify);
    const res = await route(new Request(URL_, { method: "POST" }));
    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toContain("resource_metadata=");
    expect(res.headers.get("Access-Control-Expose-Headers")).toContain(
      "WWW-Authenticate",
    );
    expect(verify).not.toHaveBeenCalled();
  });

  it("rejects a token that doesn't verify, or whose check throws", async () => {
    const route = mcpRoute(ok(), async () => undefined);
    const res = await route(post());
    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toContain("invalid_token");

    const throwing = mcpRoute(ok(), async () => {
      throw new Error("Clerk is down");
    });
    expect((await throwing(post())).status).toBe(401);
    expect(console.error).toHaveBeenCalled();
  });

  it("rejects an expired token", async () => {
    const route = mcpRoute(ok(), async () => ({
      ...authInfo,
      expiresAt: Math.floor(Date.now() / 1000) - 60,
    }));
    const res = await route(post());
    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toContain("has expired");
  });

  it("passes the verified auth to the handler untouched for streaming clients", async () => {
    const handler = ok();
    const route = mcpRoute(handler, async () => ({
      ...authInfo,
      expiresAt: Math.floor(Date.now() / 1000) + 60,
    }));
    const req = post({ accept: "application/json, text/event-stream" });
    const res = await route(req);
    expect(res.status).toBe(200);
    const passed = handler.mock.calls[0][0] as Request & { auth?: AuthInfo };
    expect(passed).toBe(req);
    expect(passed.auth?.extra?.userId).toBe("user_1");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("passes GET requests through as they are", async () => {
    const handler = ok();
    const route = mcpRoute(handler, async () => authInfo);
    const req = new Request(URL_, {
      headers: { authorization: "Bearer oat_1" },
    });
    await route(req);
    expect(handler.mock.calls[0][0]).toBe(req);
  });

  it("answers JSON-only clients with plain JSON", async () => {
    const handler = vi.fn(
      async (_req: Request) =>
        new Response('event: message\ndata: {"jsonrpc":"2.0","id":1}\n\n', {
          headers: {
            "content-type": "text/event-stream",
            "cache-control": "no-cache",
          },
        }),
    );
    const route = mcpRoute(handler, async () => authInfo);
    const res = await route(post({ accept: "application/json" }, '{"x":1}'));
    const passed = handler.mock.calls[0][0];
    expect(passed.headers.get("accept")).toBe(
      "application/json, text/event-stream",
    );
    await expect(passed.text()).resolves.toBe('{"x":1}');
    expect(res.headers.get("content-type")).toBe("application/json");
    expect(res.headers.get("cache-control")).toBeNull();
    await expect(res.json()).resolves.toEqual({ jsonrpc: "2.0", id: 1 });
  });

  it("answers a batch as an array and an empty stream as 202", async () => {
    const stream = (body: string) => async () =>
      new Response(body, { headers: { "content-type": "text/event-stream" } });
    const batch = mcpRoute(
      vi.fn(stream('data: {"id":1}\n\ndata: {"id":2}\n\n')),
      async () => authInfo,
    );
    const res = await batch(post());
    await expect(res.json()).resolves.toEqual([{ id: 1 }, { id: 2 }]);

    const empty = mcpRoute(vi.fn(stream("")), async () => authInfo);
    expect((await empty(post({ accept: "*/*" }))).status).toBe(202);
    // No Accept header at all is served as JSON too.
    expect((await empty(post())).status).toBe(202);
  });

  it("leaves a JSON answer alone for JSON-only clients", async () => {
    const route = mcpRoute(ok(), async () => authInfo);
    const res = await route(post({ accept: "application/json" }));
    await expect(res.json()).resolves.toEqual({
      jsonrpc: "2.0",
      id: 1,
      result: {},
    });
  });

  it("passes an answer without a body type through", async () => {
    const route = mcpRoute(
      vi.fn(async () => new Response(null, { status: 202 })),
      async () => authInfo,
    );
    expect((await route(post({ accept: "application/json" }))).status).toBe(
      202,
    );
  });

  it("keeps the stream for clients that only take event streams", async () => {
    const handler = vi.fn(
      async () =>
        new Response("data: {}\n\n", {
          headers: { "content-type": "text/event-stream" },
        }),
    );
    const route = mcpRoute(handler, async () => authInfo);
    const res = await route(post({ accept: "text/event-stream" }));
    expect(res.headers.get("content-type")).toBe("text/event-stream");
  });
});
