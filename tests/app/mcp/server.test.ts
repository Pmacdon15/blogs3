import {
  type AuthInfo,
  InMemoryTransport,
  type JSONRPCMessage,
  McpServer,
} from "@modelcontextprotocol/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

/*
 * The MCP server as a host (Claude, ChatGPT, ...) sees it: a real McpServer
 * set up exactly like /api/mcp, driven over an in-memory transport with raw
 * JSON-RPC.
 */

const m = vi.hoisted(() => ({
  listPostsForAdmin: vi.fn(),
  getPostForEdit: vi.fn(),
  createPost: vi.fn(),
  updatePost: vi.fn(),
  setPostStatus: vi.fn(),
  deletePost: vi.fn(),
  uploadImage: vi.fn(),
  isAdmin: vi.fn(async () => true),
  revalidatePostCaches: vi.fn(),
  dbSearchPublishedPosts: vi.fn(),
}));

vi.mock("@/lib/dal/posts", () => ({
  listPostsForAdmin: m.listPostsForAdmin,
  getPostForEdit: m.getPostForEdit,
  createPost: m.createPost,
  updatePost: m.updatePost,
  setPostStatus: m.setPostStatus,
  deletePost: m.deletePost,
  uploadImage: m.uploadImage,
}));
vi.mock("@/lib/dal/auth", () => ({ isAdmin: m.isAdmin }));
vi.mock("@/lib/cache/revalidate", () => ({
  revalidatePostCaches: m.revalidatePostCaches,
}));
vi.mock("@/db/posts", () => ({
  dbSearchPublishedPosts: m.dbSearchPublishedPosts,
}));

import {
  appResourceMeta,
  appToolMeta,
  BLOG_APPS,
  MCP_APP_MIME_TYPE,
  POST_PREVIEW_APP,
  POSTS_LIST_APP,
} from "@/mcp/apps";
import { MCP_INSTRUCTIONS } from "@/mcp/instructions";
import {
  draftPostPromptText,
  registerBlogPrompts,
  reviewPostPromptText,
} from "@/mcp/prompts";
import {
  registerBlogTools,
  respond,
  run,
  SERVER_INFO,
  SERVER_OPTIONS,
  TOOLS,
  userIdFrom,
} from "@/mcp/server";
import { TOOL_CATALOG, toolInfo } from "@/mcp/tool-catalog";

const ID = "6f1c1d3e-8a39-4b8e-9d0a-1f2e3d4c5b6a";
const post = {
  id: ID,
  authorId: "user_admin",
  slug: "hello",
  title: "Hello",
  excerpt: "",
  coverImageUrl: null,
  blocks: [{ id: "t1", type: "text", text: "Hi" }],
  tags: [],
  status: "draft",
  publishedAt: null,
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
};
const change = { id: ID, slugs: ["hello"] };

/** A connected client: sends JSON-RPC as `userId` (or signed out) and awaits the answer. */
async function connect(userId: string | null = "user_admin") {
  const server = new McpServer(SERVER_OPTIONS.serverInfo, SERVER_OPTIONS);
  registerBlogTools(server);
  registerBlogPrompts(server);
  const [client, serverSide] = InMemoryTransport.createLinkedPair();
  const answers = new Map<number, (msg: JSONRPCMessage) => void>();
  client.onmessage = (msg) => {
    const id = (msg as { id?: number }).id;
    if (typeof id === "number" && answers.has(id)) {
      answers.get(id)?.(msg);
      answers.delete(id);
    }
  };
  await server.connect(serverSide);
  await client.start();
  const authInfo: AuthInfo | undefined = userId
    ? { token: "t", clientId: "c", scopes: [], extra: { userId } }
    : undefined;
  let nextId = 1;
  const rpc = async (method: string, params: Record<string, unknown> = {}) => {
    const id = nextId++;
    const answer = new Promise<JSONRPCMessage>((resolve) =>
      answers.set(id, resolve),
    );
    await client.send({ jsonrpc: "2.0", id, method, params }, { authInfo });
    const msg = (await answer) as {
      result?: Record<string, unknown>;
      error?: { message: string };
    };
    if (msg.error) throw new Error(msg.error.message);
    return msg.result as Record<string, unknown>;
  };
  await rpc("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {
      extensions: {
        "io.modelcontextprotocol/ui": { mimeTypes: [MCP_APP_MIME_TYPE] },
      },
    },
    clientInfo: { name: "test-host", version: "1.0.0" },
  });
  await client.send(
    { jsonrpc: "2.0", method: "notifications/initialized" },
    { authInfo },
  );
  return rpc;
}

type Tool = {
  name: string;
  description: string;
  inputSchema: { properties?: Record<string, unknown>; required?: string[] };
  annotations?: Record<string, unknown>;
  _meta?: Record<string, unknown>;
};
type ToolCall = {
  content: { type: string; text: string }[];
  structuredContent: Record<string, unknown>;
  isError?: boolean;
};

const call = async (
  rpc: Awaited<ReturnType<typeof connect>>,
  name: string,
  args: Record<string, unknown>,
) => (await rpc("tools/call", { name, arguments: args })) as ToolCall;

beforeEach(() => {
  m.isAdmin.mockResolvedValue(true);
  m.getPostForEdit.mockResolvedValue({ ok: true, data: post });
});

describe("tools/list", () => {
  it("exposes every tool", async () => {
    const rpc = await connect();
    const { tools } = (await rpc("tools/list")) as { tools: Tool[] };
    expect(tools.map((t) => t.name).sort()).toEqual([
      "add_block",
      "create_post",
      "delete_post",
      "get_post",
      "list_posts",
      "move_block",
      "publish_post",
      "remove_block",
      "search_published_posts",
      "unpublish_post",
      "update_block",
      "update_post",
      "upload_image",
      "whoami",
    ]);
    expect(TOOL_CATALOG.map((t) => t.name).sort()).toEqual(
      tools.map((t) => t.name).sort(),
    );
  });

  it("marks reads read-only and destructive writes destructive", async () => {
    const rpc = await connect();
    const { tools } = (await rpc("tools/list")) as { tools: Tool[] };
    const byName = new Map(tools.map((t) => [t.name, t.annotations]));
    for (const name of [
      "whoami",
      "list_posts",
      "get_post",
      "search_published_posts",
    ]) {
      expect(byName.get(name)?.readOnlyHint, name).toBe(true);
    }
    for (const name of [
      "update_post",
      "update_block",
      "remove_block",
      "delete_post",
    ]) {
      expect(byName.get(name)?.destructiveHint, name).toBe(true);
      expect(byName.get(name)?.readOnlyHint, name).toBe(false);
    }
    for (const name of [
      "create_post",
      "add_block",
      "move_block",
      "publish_post",
      "unpublish_post",
      "upload_image",
    ]) {
      expect(byName.get(name)?.destructiveHint, name).toBe(false);
    }
    for (const name of ["create_post", "add_block", "upload_image"]) {
      expect(byName.get(name)?.idempotentHint, name).toBe(false);
    }
    for (const name of [
      "update_post",
      "move_block",
      "publish_post",
      "delete_post",
    ]) {
      expect(byName.get(name)?.idempotentHint, name).toBe(true);
    }
    expect(byName.get("upload_image")?.openWorldHint).toBe(true);
    expect(byName.get("get_post")?.title).toBe("Get a post");
  });

  it("says which tools are admin only", async () => {
    const rpc = await connect();
    const { tools } = (await rpc("tools/list")) as { tools: Tool[] };
    const byName = new Map(tools.map((t) => [t.name, t.description]));
    expect(byName.get("create_post")).toMatch(/^Admin only\. /);
    expect(byName.get("search_published_posts")).not.toMatch(/Admin only/);
    expect(byName.get("delete_post")).toMatch(/explicitly asks/);
    expect(toolInfo("whoami").adminOnly).toBe(false);
  });

  it("requires confirm on delete_post and an id or slug on get_post", async () => {
    const rpc = await connect();
    const { tools } = (await rpc("tools/list")) as { tools: Tool[] };
    const del = tools.find((t) => t.name === "delete_post");
    expect(del?.inputSchema.required).toEqual(["id", "confirm"]);
    const create = tools.find((t) => t.name === "create_post");
    expect(create?.inputSchema.required).toEqual(["title"]);
    expect(Object.keys(create?.inputSchema.properties ?? {})).toEqual([
      "title",
      "slug",
      "excerpt",
      "coverImageUrl",
      "tags",
      "blocks",
    ]);
  });

  it("links the post tools to the preview app and the list tools to the list app", async () => {
    const rpc = await connect();
    const { tools } = (await rpc("tools/list")) as { tools: Tool[] };
    const withApp = (uri: string) =>
      tools
        .filter(
          (t) => (t._meta?.ui as { resourceUri?: string })?.resourceUri === uri,
        )
        .map((t) => t.name)
        .sort();
    expect(withApp(POST_PREVIEW_APP.uri)).toEqual([
      "add_block",
      "create_post",
      "get_post",
      "move_block",
      "publish_post",
      "remove_block",
      "unpublish_post",
      "update_block",
      "update_post",
    ]);
    expect(withApp(POSTS_LIST_APP.uri)).toEqual([
      "list_posts",
      "search_published_posts",
    ]);
    const get = tools.find((t) => t.name === "get_post");
    expect(get?._meta).toEqual(appToolMeta(POST_PREVIEW_APP));
    expect(get?._meta?.["openai/outputTemplate"]).toBe(POST_PREVIEW_APP.uri);
    expect(get?._meta?.["ui/resourceUri"]).toBe(POST_PREVIEW_APP.uri);
    for (const name of ["whoami", "delete_post", "upload_image"]) {
      expect(tools.find((t) => t.name === name)?._meta, name).toBeUndefined();
    }
  });
});

describe("MCP Apps resources", () => {
  it("lists each app as a ui:// resource of type text/html;profile=mcp-app", async () => {
    const rpc = await connect();
    const { resources } = (await rpc("resources/list")) as {
      resources: { uri: string; mimeType: string; _meta?: unknown }[];
    };
    expect(resources.map((r) => r.uri).sort()).toEqual(
      ["ui://blogs3/post-preview.html", "ui://blogs3/posts-list.html"].sort(),
    );
    for (const r of resources) {
      expect(r.mimeType).toBe(MCP_APP_MIME_TYPE);
    }
  });

  it("serves self-contained HTML that speaks the MCP Apps bridge", async () => {
    const rpc = await connect();
    for (const app of BLOG_APPS) {
      const { contents } = (await rpc("resources/read", { uri: app.uri })) as {
        contents: {
          uri: string;
          mimeType: string;
          text: string;
          _meta: unknown;
        }[];
      };
      expect(contents).toHaveLength(1);
      const [page] = contents;
      expect(page.uri).toBe(app.uri);
      expect(page.mimeType).toBe(MCP_APP_MIME_TYPE);
      expect(page._meta).toEqual(appResourceMeta(app));
      expect(page.text).toMatch(/^<!doctype html>/);
      expect(page.text).toContain(`data-view="${app.view}"`);
      expect(page.text).not.toMatch(/<script[^>]+src=|<link[^>]+href=/i);
      expect(page.text).not.toMatch(/\bfetch\(|XMLHttpRequest|innerHTML/);
      for (const method of [
        "ui/initialize",
        "ui/notifications/initialized",
        "ui/notifications/tool-result",
        "tools/call",
        "window.openai",
        "toolOutput",
        "createTextNode",
      ]) {
        expect(page.text, method).toContain(method);
      }
    }
  });

  it("allows only outside https images in the apps' CSP", () => {
    expect(appResourceMeta(POST_PREVIEW_APP).ui.csp).toEqual({
      connectDomains: [],
      resourceDomains: ["https:"],
    });
  });
});

describe("tools/call", () => {
  it("returns text and structuredContent, using the token's user id", async () => {
    const rpc = await connect("user_admin");
    const result = await call(rpc, "get_post", { id: ID });
    expect(m.getPostForEdit).toHaveBeenCalledWith("user_admin", ID);
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Here's the post.");
    expect(JSON.parse(result.content[1].text)).toEqual(
      result.structuredContent,
    );
    expect(result.structuredContent).toMatchObject({ view: "post", post });
  });

  it("answers whoami for the token's user", async () => {
    const rpc = await connect("user_admin");
    const result = await call(rpc, "whoami", {});
    expect(result.structuredContent).toEqual({
      userId: "user_admin",
      isAdmin: true,
    });
  });

  it("revalidates the post's caches after a write", async () => {
    m.setPostStatus.mockResolvedValue({
      ok: true,
      data: { post: { ...post, status: "published" }, change },
    });
    const rpc = await connect();
    const result = await call(rpc, "publish_post", { id: ID });
    expect(result.isError).toBeUndefined();
    expect(m.revalidatePostCaches).toHaveBeenCalledWith(change);
  });

  it("rejects invalid input before running the tool", async () => {
    const rpc = await connect();
    const result = await call(rpc, "delete_post", { id: ID });
    expect(result.isError).toBe(true);
    expect(m.deletePost).not.toHaveBeenCalled();
    const bad = await call(rpc, "create_post", { title: "" });
    expect(bad.isError).toBe(true);
    expect(m.createPost).not.toHaveBeenCalled();
  });

  it("refuses every tool without a signed-in caller", async () => {
    const rpc = await connect(null);
    for (const tool of TOOLS) {
      const result = await call(rpc, tool.name, {});
      expect(result.isError, tool.name).toBe(true);
    }
    const result = await call(rpc, "whoami", {});
    expect(result.content[0].text).toMatch(/Not signed in/);
    expect(m.isAdmin).not.toHaveBeenCalled();
  });

  it("passes the DAL's refusal on to non-admins", async () => {
    m.listPostsForAdmin.mockResolvedValue({
      ok: false,
      error: "You don't have permission to edit posts.",
    });
    const rpc = await connect("user_reader");
    const result = await call(rpc, "list_posts", {});
    expect(m.listPostsForAdmin).toHaveBeenCalledWith("user_reader");
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/permission/);
  });
});

describe("run", () => {
  const auth: AuthInfo = {
    token: "t",
    clientId: "c",
    scopes: [],
    extra: { userId: "user_1" },
  };

  it("turns zod errors into a readable tool error", async () => {
    const result = await run(auth, async () => {
      z.object({ id: z.string(), n: z.number() }).parse({ n: "x" });
      throw new Error("unreachable");
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/^Invalid input: id: .+; n: /);

    const root = await run(auth, async () => {
      z.string().parse(1);
      throw new Error("unreachable");
    });
    expect(root.content[0].text).toMatch(/^Invalid input: input: /);
  });

  it("hides unexpected errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await run(auth, async () => {
      throw new Error("db down");
    });
    expect(result).toMatchObject({
      isError: true,
      structuredContent: { error: "internal_error" },
    });
    expect(result.content[0].text).not.toContain("db down");
  });

  it("only trusts a non-empty string user id from the token", () => {
    expect(userIdFrom(auth)).toBe("user_1");
    expect(userIdFrom(undefined)).toBeNull();
    expect(userIdFrom({ ...auth, extra: { userId: "" } })).toBeNull();
    expect(userIdFrom({ ...auth, extra: { userId: 42 } })).toBeNull();
    expect(userIdFrom({ ...auth, extra: undefined })).toBeNull();
  });

  it("adds isError only for errors", () => {
    expect(respond({ summary: "ok", data: {} })).not.toHaveProperty("isError");
  });
});

describe("server info, instructions and prompts", () => {
  it("advertises fixed lists and the blog's name", () => {
    expect(SERVER_OPTIONS.serverInfo).toBe(SERVER_INFO);
    expect(SERVER_INFO.name).toBe("blogs3");
    expect(SERVER_OPTIONS.capabilities).toEqual({
      tools: { listChanged: false },
      prompts: { listChanged: false },
      resources: { listChanged: false },
    });
    expect(SERVER_OPTIONS.instructions).toBe(MCP_INSTRUCTIONS);
    expect(MCP_INSTRUCTIONS).toMatch(/confirm: true/);
    expect(MCP_INSTRUCTIONS).toMatch(/upload_image/);
  });

  it("lists and renders the prompts", async () => {
    const rpc = await connect();
    const { prompts } = (await rpc("prompts/list")) as {
      prompts: { name: string }[];
    };
    expect(prompts.map((p) => p.name).sort()).toEqual([
      "draft_post",
      "review_post",
    ]);
    const draft = (await rpc("prompts/get", {
      name: "draft_post",
      arguments: { topic: "caching" },
    })) as { messages: { role: string; content: { text: string } }[] };
    expect(draft.messages[0].role).toBe("user");
    expect(draft.messages[0].content.text).toContain(
      "Draft a blog post about caching",
    );
    const review = (await rpc("prompts/get", {
      name: "review_post",
      arguments: {},
    })) as { messages: { content: { text: string } }[] };
    expect(review.messages[0].content.text).toContain("Ask me which one");
  });

  it("builds the draft_post text from the arguments", () => {
    const full = draftPostPromptText({
      topic: " Next.js ",
      audience: "beginners",
      tone: "friendly",
    });
    expect(full).toContain("Draft a blog post about Next.js for my blog.");
    expect(full).toContain("It's for beginners.");
    expect(full).toContain("Keep the tone friendly.");
    expect(full).toContain("create_post");
    const empty = draftPostPromptText({ topic: " " });
    expect(empty).toMatch(/^Help me draft/);
    expect(empty).not.toContain("It's for");
    expect(empty).not.toContain("Keep the tone");
  });

  it("builds the review_post text from the arguments", () => {
    expect(reviewPostPromptText({ post: "hello" })).toMatch(
      /^Review my blog post "hello"\./,
    );
    expect(reviewPostPromptText({})).toMatch(/Ask me which one/);
  });
});
