import { createMcpHandler } from "mcp-handler";
import { verifyMcpToken } from "@/mcp/auth";
import { mcpRoute } from "@/mcp/http";
import { registerBlogPrompts } from "@/mcp/prompts";
import { registerBlogTools, SERVER_OPTIONS } from "@/mcp/server";

/*
 * /api/mcp — the blog's MCP server.
 *
 * Auth is a Clerk OAuth access token in `Authorization: Bearer ...`. Without
 * one, the 401 points the client at
 * `/.well-known/oauth-protected-resource/api/mcp`, which sends it to Clerk to
 * sign the user in. Every tool runs only for that token's verified Clerk
 * user, and the DAL checks that user is an admin before any private read or
 * write. Prompts only build instructions and touch no data.
 */
const handler = createMcpHandler((server) => {
  registerBlogTools(server);
  registerBlogPrompts(server);
}, SERVER_OPTIONS);
const route = mcpRoute(handler, verifyMcpToken);

export { route as DELETE, route as GET, route as OPTIONS, route as POST };
