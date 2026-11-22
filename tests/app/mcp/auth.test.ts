import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockAuthenticateRequest = vi.fn();
const mockVerifyAccessToken = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: async () => ({
    authenticateRequest: mockAuthenticateRequest,
    idPOAuthAccessToken: { verify: mockVerifyAccessToken },
  }),
}));

import {
  allowedOAuthClientIds,
  audienceMode,
  looksLikeOAuthToken,
  verifyMcpToken,
} from "@/mcp/auth";
import { mcpResourceUrl } from "@/mcp/http";

const tokenState = (clientId: string | null) => ({
  toAuth: () => ({
    isAuthenticated: true,
    tokenType: "oauth_token",
    userId: "user_1",
    clientId,
    scopes: ["profile"],
  }),
});

describe("verifyMcpToken client allowlist", () => {
  const req = new Request("https://blog.example.com/api/mcp");

  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    mockAuthenticateRequest.mockReset();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("parses comma or whitespace separated client IDs", () => {
    expect(allowedOAuthClientIds(" a, b\nc ")).toEqual(
      new Set(["a", "b", "c"]),
    );
    expect(allowedOAuthClientIds("")).toBeNull();
    expect(allowedOAuthClientIds(undefined)).toBeNull();
  });

  it("accepts every client when the allowlist is unset, empty or *", () => {
    expect(allowedOAuthClientIds("  ")).toBeNull();
    expect(allowedOAuthClientIds("*")).toBeNull();
    expect(allowedOAuthClientIds("client_a, *")).toBeNull();
    expect(allowedOAuthClientIds("client_a")).toEqual(new Set(["client_a"]));
  });

  it.each(["production", "preview"])(
    "accepts any client on %s when no allowlist is set",
    async (env) => {
      vi.stubEnv("VERCEL_ENV", env);
      vi.stubEnv("MCP_ALLOWED_OAUTH_CLIENT_IDS", "");
      vi.stubEnv("MCP_TOKEN_AUDIENCE", "off");
      mockAuthenticateRequest.mockResolvedValueOnce(tokenState("client_x"));

      const info = await verifyMcpToken(req, "oat_1");
      expect(info?.clientId).toBe("client_x");
    },
  );

  it("accepts any client in production when the allowlist is *", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("MCP_ALLOWED_OAUTH_CLIENT_IDS", "*");
    vi.stubEnv("MCP_TOKEN_AUDIENCE", "off");
    mockAuthenticateRequest.mockResolvedValueOnce(tokenState("client_x"));

    expect(await verifyMcpToken(req, "oat_1")).toBeDefined();
  });

  it("accepts any client when no allowlist is configured", async () => {
    vi.stubEnv("MCP_ALLOWED_OAUTH_CLIENT_IDS", "");
    mockAuthenticateRequest.mockResolvedValueOnce(tokenState("client_x"));

    const info = await verifyMcpToken(req, "oat_1");
    expect(info?.extra?.userId).toBe("user_1");
  });

  it("accepts an allowlisted client", async () => {
    vi.stubEnv("MCP_ALLOWED_OAUTH_CLIENT_IDS", "client_claude,client_gemini");
    mockAuthenticateRequest.mockResolvedValueOnce(tokenState("client_gemini"));

    const info = await verifyMcpToken(req, "oat_1");
    expect(info?.clientId).toBe("client_gemini");
  });

  it("rejects a client that isn't on the allowlist, or has no client ID", async () => {
    vi.stubEnv("MCP_ALLOWED_OAUTH_CLIENT_IDS", "client_claude");
    mockAuthenticateRequest.mockResolvedValueOnce(tokenState("client_other"));
    expect(await verifyMcpToken(req, "oat_1")).toBeUndefined();

    mockAuthenticateRequest.mockResolvedValueOnce(tokenState(null));
    expect(await verifyMcpToken(req, "oat_2")).toBeUndefined();
  });
});

describe("verifyMcpToken audience check", () => {
  const req = new Request("https://blog.example.com/api/mcp");

  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    mockAuthenticateRequest.mockReset();
    mockVerifyAccessToken.mockReset();
    mockAuthenticateRequest.mockResolvedValue(tokenState("client_x"));
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("reads the mode from MCP_TOKEN_AUDIENCE", () => {
    expect(audienceMode(" Enforce ")).toBe("enforce");
    expect(audienceMode("log")).toBe("log");
    expect(audienceMode("off")).toBe("off");
  });

  it("defaults to log everywhere, never enforce", () => {
    for (const env of ["", "development", "preview", "production"]) {
      vi.stubEnv("VERCEL_ENV", env);
      expect(audienceMode(undefined)).toBe("log");
      expect(audienceMode("")).toBe("log");
      expect(audienceMode("yes")).toBe("log");
    }
  });

  it("logs but accepts a token without aud when MCP_TOKEN_AUDIENCE is unset", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("MCP_ALLOWED_OAUTH_CLIENT_IDS", "client_x");
    vi.stubEnv("MCP_TOKEN_AUDIENCE", "");
    mockVerifyAccessToken.mockRejectedValueOnce(new Error("aud mismatch"));

    expect(await verifyMcpToken(req, "oat_1")).toBeDefined();
    expect(mockVerifyAccessToken).toHaveBeenCalledWith("oat_1", {
      audience: mcpResourceUrl(req),
    });
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("MCP_TOKEN_AUDIENCE=log"),
    );
  });

  it("skips the extra Clerk call when off", async () => {
    vi.stubEnv("MCP_TOKEN_AUDIENCE", "off");
    expect(await verifyMcpToken(req, "oat_1")).toBeDefined();
    expect(mockVerifyAccessToken).not.toHaveBeenCalled();
  });

  it("accepts a token issued for this server when enforcing", async () => {
    vi.stubEnv("MCP_TOKEN_AUDIENCE", "enforce");
    mockVerifyAccessToken.mockResolvedValueOnce({ aud: [mcpResourceUrl(req)] });
    expect(await verifyMcpToken(req, "oat_1")).toBeDefined();
    expect(mockVerifyAccessToken).toHaveBeenCalledWith("oat_1", {
      audience: mcpResourceUrl(req),
    });
  });

  it("rejects a token for another audience when enforcing", async () => {
    vi.stubEnv("MCP_TOKEN_AUDIENCE", "enforce");
    mockVerifyAccessToken.mockRejectedValueOnce(new Error("aud mismatch"));
    expect(await verifyMcpToken(req, "oat_1")).toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("aud mismatch"),
    );
  });

  it("only warns in log mode", async () => {
    vi.stubEnv("MCP_TOKEN_AUDIENCE", "log");
    mockVerifyAccessToken.mockRejectedValueOnce("nope");
    expect(await verifyMcpToken(req, "oat_1")).toBeDefined();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("MCP_TOKEN_AUDIENCE=log"),
    );
  });
});

describe("verifyMcpToken token format pre-check", () => {
  const req = new Request("https://blog.example.com/api/mcp");

  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    mockAuthenticateRequest.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(["oat_abc123", "oat_A-b_9", "eyJhbGciOi.eyJzdWIiOi.c2lnbmF0dXJl"])(
    "accepts the shape of %s",
    (token) => {
      expect(looksLikeOAuthToken(token)).toBe(true);
    },
  );

  it.each(["junk", "oat_", "a.b", "oat_has space", `oat_${"a".repeat(5000)}`])(
    "rejects the shape of %s",
    (token) => {
      expect(looksLikeOAuthToken(token)).toBe(false);
    },
  );

  it("refuses a malformed token without calling Clerk", async () => {
    expect(await verifyMcpToken(req, "not-a-token")).toBeUndefined();
    expect(mockAuthenticateRequest).not.toHaveBeenCalled();
  });
});

describe("verifyMcpToken Clerk verification", () => {
  const req = new Request("https://blog.example.com/api/mcp");

  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    mockAuthenticateRequest.mockReset();
    vi.stubEnv("MCP_ALLOWED_OAUTH_CLIENT_IDS", "");
    vi.stubEnv("MCP_TOKEN_AUDIENCE", "off");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns nothing without a token", async () => {
    expect(await verifyMcpToken(req, undefined)).toBeUndefined();
    expect(mockAuthenticateRequest).not.toHaveBeenCalled();
  });

  it("puts only the verified Clerk user id in extra.userId", async () => {
    mockAuthenticateRequest.mockResolvedValueOnce(tokenState("client_x"));
    const info = await verifyMcpToken(req, "oat_1");
    expect(info).toEqual({
      token: "oat_1",
      clientId: "client_x",
      scopes: ["profile"],
      extra: { userId: "user_1", via: "oauth", verifiedBy: "clerk" },
    });
    const [checked, options] = mockAuthenticateRequest.mock.calls[0];
    expect((checked as Request).headers.get("authorization")).toBe(
      "Bearer oat_1",
    );
    expect(options).toEqual({ acceptsToken: "oauth_token" });
  });

  it("falls back to a generic client id and no scopes", async () => {
    mockAuthenticateRequest.mockResolvedValueOnce({
      toAuth: () => ({
        isAuthenticated: true,
        tokenType: "oauth_token",
        userId: "user_1",
        clientId: null,
      }),
    });
    const info = await verifyMcpToken(req, "oat_1");
    expect(info?.clientId).toBe("oauth");
    expect(info?.scopes).toEqual([]);
  });

  it("rejects a token Clerk refuses, with or without a reason", async () => {
    mockAuthenticateRequest.mockResolvedValueOnce({
      reason: "token-expired",
      message: "Token has expired",
      toAuth: () => ({ isAuthenticated: false }),
    });
    expect(await verifyMcpToken(req, "oat_1")).toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("token-expired: Token has expired"),
    );

    mockAuthenticateRequest.mockResolvedValueOnce({ toAuth: () => null });
    expect(await verifyMcpToken(req, "oat_1")).toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("no reason given"),
    );
  });

  it("rejects a session token or a token without a user", async () => {
    mockAuthenticateRequest.mockResolvedValueOnce({
      toAuth: () => ({ isAuthenticated: true, tokenType: "session_token" }),
    });
    expect(await verifyMcpToken(req, "oat_1")).toBeUndefined();

    mockAuthenticateRequest.mockResolvedValueOnce({
      toAuth: () => ({
        isAuthenticated: true,
        tokenType: "oauth_token",
        userId: null,
      }),
    });
    expect(await verifyMcpToken(req, "oat_1")).toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("without a user"),
    );
  });

  it("names the missing client id when rejecting a token", async () => {
    vi.stubEnv("MCP_ALLOWED_OAUTH_CLIENT_IDS", "client_claude");
    mockAuthenticateRequest.mockResolvedValueOnce(tokenState(null));
    expect(await verifyMcpToken(req, "oat_1")).toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("client (none)"),
    );
  });
});
