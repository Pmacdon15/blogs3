import type {
  AuthInfo,
  McpServer,
  StandardSchemaWithJSON,
  ToolAnnotations,
} from "@modelcontextprotocol/server";
import { z } from "zod";
import {
  appToolMeta,
  type BlogApp,
  POST_PREVIEW_APP,
  POSTS_LIST_APP,
  registerBlogApps,
} from "@/mcp/apps";
import { MCP_INSTRUCTIONS } from "@/mcp/instructions";
import { type ToolInfo, toolInfo } from "@/mcp/tool-catalog";
import {
  addBlock,
  addBlockInputSchema,
  createPost,
  createPostInputSchema,
  deletePost,
  deletePostInputSchema,
  getPost,
  getPostInputSchema,
  listPosts,
  listPostsInputSchema,
  moveBlock,
  moveBlockInputSchema,
  postIdInputSchema,
  publishPost,
  removeBlock,
  removeBlockInputSchema,
  searchPublishedPosts,
  searchPublishedPostsInputSchema,
  type ToolResult,
  unpublishPost,
  updateBlock,
  updateBlockInputSchema,
  updatePostInputSchema,
  updatePostTool,
  uploadImage,
  uploadImageInputSchema,
  whoami,
  whoamiInputSchema,
} from "@/mcp/tools";

/*
 * The blog's MCP server: its name, instructions, tools, prompts and apps.
 * Standard MCP only, so any MCP client (Claude, ChatGPT, ...) can use it.
 */

export const SERVER_INFO = {
  name: "blogs",
  title: "Blogs",
  version: "1.0.0",
};

export const SERVER_OPTIONS = {
  serverInfo: SERVER_INFO,
  instructions: MCP_INSTRUCTIONS,
  // The tool, prompt and resource lists never change while a client is
  // connected. Saying so keeps clients from holding a change-notification
  // stream open on serverless functions.
  capabilities: {
    tools: { listChanged: false },
    prompts: { listChanged: false },
    resources: { listChanged: false },
  },
};

/** The verified caller's Clerk user id, from the token only, or null. */
export function userIdFrom(authInfo: AuthInfo | undefined): string | null {
  const userId = authInfo?.extra?.userId;
  return typeof userId === "string" && userId ? userId : null;
}

const text = (value: string) => ({ type: "text" as const, text: value });

/** A tool's result as MCP content: the sentence first, then the data as JSON. */
export function respond(result: ToolResult) {
  return {
    content: [text(result.summary), text(JSON.stringify(result.data, null, 2))],
    structuredContent: result.data,
    ...(result.isError ? { isError: true } : {}),
  };
}

/** Runs a tool for the verified caller; bad input becomes a readable tool error. */
export async function run(
  authInfo: AuthInfo | undefined,
  tool: (userId: string) => Promise<ToolResult>,
) {
  const userId = userIdFrom(authInfo);
  if (!userId) {
    return respond({
      summary:
        "Not signed in to the blog. Reconnect the connector and sign in.",
      data: { error: "unauthorized" },
      isError: true,
    });
  }
  try {
    return respond(await tool(userId));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return respond({
        summary: `Invalid input: ${error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ")}`,
        data: { error: "invalid_input" },
        isError: true,
      });
    }
    console.error("MCP: tool failed", error);
    return respond({
      summary: "Something went wrong on the blog. Try again shortly.",
      data: { error: "internal_error" },
      isError: true,
    });
  }
}

const READ_ONLY: ToolAnnotations = { readOnlyHint: true, openWorldHint: false };

const write = (
  destructiveHint: boolean,
  idempotentHint: boolean,
  openWorldHint = false,
): ToolAnnotations => ({
  readOnlyHint: false,
  destructiveHint,
  idempotentHint,
  openWorldHint,
});

type ToolDefinition = ToolInfo & {
  inputSchema: StandardSchemaWithJSON;
  annotations: ToolAnnotations;
  app?: BlogApp;
  handler: (userId: string, args: unknown) => Promise<ToolResult>;
};

export const TOOLS: ToolDefinition[] = [
  {
    ...toolInfo("whoami"),
    inputSchema: whoamiInputSchema,
    annotations: READ_ONLY,
    handler: whoami,
  },
  {
    ...toolInfo("list_posts"),
    inputSchema: listPostsInputSchema,
    annotations: READ_ONLY,
    app: POSTS_LIST_APP,
    handler: listPosts,
  },
  {
    ...toolInfo("get_post"),
    inputSchema: getPostInputSchema,
    annotations: READ_ONLY,
    app: POST_PREVIEW_APP,
    handler: getPost,
  },
  {
    ...toolInfo("search_published_posts"),
    inputSchema: searchPublishedPostsInputSchema,
    annotations: READ_ONLY,
    app: POSTS_LIST_APP,
    handler: searchPublishedPosts,
  },
  {
    ...toolInfo("create_post"),
    inputSchema: createPostInputSchema,
    annotations: write(false, false),
    app: POST_PREVIEW_APP,
    handler: createPost,
  },
  {
    ...toolInfo("update_post"),
    inputSchema: updatePostInputSchema,
    annotations: write(true, true),
    app: POST_PREVIEW_APP,
    handler: updatePostTool,
  },
  {
    ...toolInfo("add_block"),
    inputSchema: addBlockInputSchema,
    annotations: write(false, false),
    app: POST_PREVIEW_APP,
    handler: addBlock,
  },
  {
    ...toolInfo("update_block"),
    inputSchema: updateBlockInputSchema,
    annotations: write(true, true),
    app: POST_PREVIEW_APP,
    handler: updateBlock,
  },
  {
    ...toolInfo("remove_block"),
    inputSchema: removeBlockInputSchema,
    annotations: write(true, true),
    app: POST_PREVIEW_APP,
    handler: removeBlock,
  },
  {
    ...toolInfo("move_block"),
    inputSchema: moveBlockInputSchema,
    annotations: write(false, true),
    app: POST_PREVIEW_APP,
    handler: moveBlock,
  },
  {
    ...toolInfo("publish_post"),
    inputSchema: postIdInputSchema,
    annotations: write(false, true),
    app: POST_PREVIEW_APP,
    handler: publishPost,
  },
  {
    ...toolInfo("unpublish_post"),
    inputSchema: postIdInputSchema,
    annotations: write(false, true),
    app: POST_PREVIEW_APP,
    handler: unpublishPost,
  },
  {
    ...toolInfo("delete_post"),
    inputSchema: deletePostInputSchema,
    annotations: write(true, true),
    handler: deletePost,
  },
  {
    ...toolInfo("upload_image"),
    inputSchema: uploadImageInputSchema,
    annotations: write(false, false, true),
    handler: uploadImage,
  },
];

export function registerBlogTools(server: McpServer) {
  registerBlogApps(server);
  for (const tool of TOOLS) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.adminOnly
          ? `Admin only. ${tool.description}`
          : tool.description,
        inputSchema: tool.inputSchema,
        annotations: { title: tool.title, ...tool.annotations },
        ...(tool.app ? { _meta: appToolMeta(tool.app) } : {}),
      },
      (args: unknown, ctx) =>
        run(ctx.http?.authInfo, (userId) => tool.handler(userId, args)),
    );
  }
}
