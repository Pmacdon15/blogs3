/*
 * What each MCP tool is called and does, with no server-only imports, so the
 * server (src/mcp/server.ts) and the admin's "Connect an AI assistant" page
 * share one list.
 */

export type ToolInfo = {
  name: string;
  title: string;
  description: string;
  /** Whether only blog admins can use it. */
  adminOnly: boolean;
};

export const TOOL_CATALOG = [
  {
    name: "whoami",
    title: "Who am I",
    description:
      "Shows the signed-in user's id and whether they are a blog admin (admins can create, edit, publish and delete posts).",
    adminOnly: false,
  },
  {
    name: "list_posts",
    title: "List posts",
    description:
      "Lists every post, drafts included, newest edit first, with id, slug, title, status, tags and dates. Pass status to show only drafts or only published posts.",
    adminOnly: true,
  },
  {
    name: "get_post",
    title: "Get a post",
    description:
      "Gets one post (any status) by id or slug, with every block and its block id.",
    adminOnly: true,
  },
  {
    name: "search_published_posts",
    title: "Search published posts",
    description:
      "Searches the published posts' titles, excerpts and tags, like the blog's search box. Available to anyone signed in.",
    adminOnly: false,
  },
  {
    name: "create_post",
    title: "Create a post",
    description:
      "Creates a draft post with a title, optional slug (made from the title when left out), excerpt, tags, cover image and blocks. It isn't public until publish_post.",
    adminOnly: true,
  },
  {
    name: "update_post",
    title: "Update a post",
    description:
      "Changes a post's title, slug, excerpt, tags or cover image, or replaces its whole body (blocks). Fields left out stay as they are.",
    adminOnly: true,
  },
  {
    name: "add_block",
    title: "Add a block",
    description:
      "Adds one heading, text, image or code block to a post, at the end or at a zero-based position.",
    adminOnly: true,
  },
  {
    name: "update_block",
    title: "Update a block",
    description:
      "Changes one block of a post (by its block id from get_post): its text, image URL/alt/caption, or code/language.",
    adminOnly: true,
  },
  {
    name: "remove_block",
    title: "Remove a block",
    description:
      "Removes one block from a post, by its block id. Only when the user asks.",
    adminOnly: true,
  },
  {
    name: "move_block",
    title: "Move a block",
    description: "Moves one block of a post to a new zero-based position.",
    adminOnly: true,
  },
  {
    name: "publish_post",
    title: "Publish a post",
    description:
      "Publishes a post so it appears on the blog. The post needs at least one block. Only when the user asks.",
    adminOnly: true,
  },
  {
    name: "unpublish_post",
    title: "Unpublish a post",
    description:
      "Takes a post off the blog and makes it a draft again. Only when the user asks.",
    adminOnly: true,
  },
  {
    name: "delete_post",
    title: "Delete a post",
    description:
      "Permanently deletes a post. Can't be undone: only when the user explicitly asks and has confirmed, with confirm: true.",
    adminOnly: true,
  },
  {
    name: "upload_image",
    title: "Upload an image",
    description:
      "Stores a PNG, JPEG, WebP, GIF or AVIF image (under 4 MB) from an https URL or base64 data, and returns its URL for an image block or a post's cover.",
    adminOnly: true,
  },
] as const satisfies readonly ToolInfo[];

export type ToolName = (typeof TOOL_CATALOG)[number]["name"];

/** One tool's catalog entry. */
export function toolInfo(name: ToolName): ToolInfo {
  return TOOL_CATALOG.find((tool) => tool.name === name) as ToolInfo;
}
