import { clerkClient } from "@clerk/nextjs/server";
import type { AuthInfo } from "@modelcontextprotocol/server";
import { mcpResourceUrl } from "@/mcp/http";

/*
 * Verifies who is calling the blog's MCP server using Clerk OAuth tokens.
 *
 * The AI app (Claude, ChatGPT, ...) sends the user to sign in with Clerk, and
 * Clerk issues an OAuth access token (`oat_...` or JWT). Clerk verifies the
 * token via `authenticateRequest` with `{ acceptsToken: "oauth_token" }`, and
 * the verified Clerk `userId` is placed in `extra.userId`: the only identity
 * any tool ever uses.
 */

/**
 * OAuth client IDs allowed to call the MCP server, from `MCP_ALLOWED_OAUTH_CLIENT_IDS`
 * (comma or whitespace separated). Clerk only grants its built-in scopes, so
 * a token's scopes can't tell a blog connection apart from any other app
 * signed in with this Clerk instance. Setting the allowlist limits the MCP
 * server to the clients you trust.
 *
 * Returns null when every client is accepted: `*`, or unset/empty (in every
 * environment). The MCP server is open to any client by default; admin
 * rights (see `@/lib/dal/auth`) still gate every private read and write.
 */
export function allowedOAuthClientIds(
  raw = process.env.MCP_ALLOWED_OAUTH_CLIENT_IDS,
): Set<string> | null {
  const ids = (raw ?? "")
    .split(/[\s,]+/)
    .map((id) => id.trim())
    .filter(Boolean);
  if (ids.length === 0 || ids.includes("*")) return null;
  return new Set(ids);
}

export type AudienceMode = "off" | "log" | "enforce";

/**
 * How strictly a token's audience (RFC 8707 `aud`) must name this MCP
 * server, from `MCP_TOKEN_AUDIENCE`: "enforce" rejects a token whose
 * audience is missing or different, "log" only warns (to see whether the
 * clients' tokens carry it before enforcing), and "off" skips the check.
 * Clerk only puts an `aud` claim in access tokens once audience claims are
 * turned on in the Clerk dashboard, so unset or unrecognised values default
 * to "log" everywhere ("enforce" is never the default). Each check is one
 * extra Clerk Backend API call.
 */
export function audienceMode(
  raw = process.env.MCP_TOKEN_AUDIENCE,
): AudienceMode {
  const mode = raw?.trim().toLowerCase();
  if (mode === "enforce" || mode === "log" || mode === "off") return mode;
  return "log";
}

/** Whether the token was issued for this server, per {@link audienceMode}. */
async function audienceAllowed(
  client: Awaited<ReturnType<typeof clerkClient>>,
  req: Request,
  token: string,
): Promise<boolean> {
  const mode = audienceMode();
  if (mode === "off") return true;
  const audience = mcpResourceUrl(req);
  try {
    await client.idPOAuthAccessToken.verify(token, { audience });
    return true;
  } catch (error) {
    console.warn(
      `MCP: OAuth access token audience isn't ${audience} (${error instanceof Error ? error.message : "verification failed"})${mode === "log" ? "; allowed because MCP_TOKEN_AUDIENCE=log" : ""}`,
    );
    return mode === "log";
  }
}

/**
 * Whether a bearer token could be a Clerk OAuth access token: an opaque
 * `oat_...` token or a JWT. Anything else is refused without a Clerk call,
 * so junk tokens cost nothing.
 */
export function looksLikeOAuthToken(token: string): boolean {
  if (token.length > 4096) return false;
  return (
    /^oat_[A-Za-z0-9_-]+$/.test(token) ||
    /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)
  );
}

export async function verifyMcpToken(
  req: Request,
  token: string | undefined,
): Promise<AuthInfo | undefined> {
  if (!token) return undefined;
  if (!looksLikeOAuthToken(token)) {
    console.warn("MCP: refused a bearer token that isn't an OAuth token");
    return undefined;
  }
  return verifyOAuthToken(req, token);
}

async function verifyOAuthToken(
  req: Request,
  token: string,
): Promise<AuthInfo | undefined> {
  const client = await clerkClient();
  const state = await client.authenticateRequest(
    new Request(req.url, { headers: { authorization: `Bearer ${token}` } }),
    { acceptsToken: "oauth_token" },
  );
  const auth = state.toAuth();
  if (!auth?.isAuthenticated || auth.tokenType !== "oauth_token") {
    console.warn(
      `MCP: Clerk rejected an OAuth access token (${state.reason ?? "no reason given"}${state.message ? `: ${state.message}` : ""})`,
    );
    return undefined;
  }
  if (!auth.userId) {
    console.warn("MCP: an OAuth access token without a user was rejected");
    return undefined;
  }
  if (!(await audienceAllowed(client, req, token))) return undefined;
  const allowed = allowedOAuthClientIds();
  if (allowed && (!auth.clientId || !allowed.has(auth.clientId))) {
    console.warn(
      `MCP: rejected an OAuth access token from client ${auth.clientId ?? "(none)"}, which isn't in MCP_ALLOWED_OAUTH_CLIENT_IDS`,
    );
    return undefined;
  }
  return {
    token,
    clientId: auth.clientId ?? "oauth",
    scopes: auth.scopes ?? [],
    extra: { userId: auth.userId, via: "oauth", verifiedBy: "clerk" },
  };
}
