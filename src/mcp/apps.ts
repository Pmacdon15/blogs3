import type { McpServer } from "@modelcontextprotocol/server";
import { type BlogAppView, blogAppHtml } from "@/mcp/apps-ui";

/*
 * The blog's in-chat apps: a post preview (title, meta and every block) for
 * get_post, create_post, update_post, the block tools and publish/unpublish,
 * and a posts list with status badges for list_posts and
 * search_published_posts, shown inside Claude, ChatGPT and other hosts
 * instead of a wall of text.
 *
 * Follows the MCP Apps extension (SEP-1865, `io.modelcontextprotocol/ui`):
 * each app is a `ui://` resource of type `text/html;profile=mcp-app`, linked
 * from its tools by `_meta.ui.resourceUri`. The OpenAI Apps SDK keys
 * (`openai/outputTemplate`, ...) point ChatGPT at the same resource. Hosts
 * without app support ignore all of this and keep using the text content.
 */

export const MCP_APP_MIME_TYPE = "text/html;profile=mcp-app";

export type BlogApp = {
  name: string;
  uri: string;
  title: string;
  description: string;
  view: BlogAppView;
  invoking: string;
  invoked: string;
};

export const POST_PREVIEW_APP: BlogApp = {
  name: "post-preview-app",
  uri: "ui://blogs3/post-preview.html",
  title: "Post preview",
  description:
    "Preview of one blog post: its title, status, tags, excerpt, cover and every block (headings, text, images and code), as it will read on the blog.",
  view: "post",
  invoking: "Loading the post…",
  invoked: "Post ready",
};

export const POSTS_LIST_APP: BlogApp = {
  name: "posts-list-app",
  uri: "ui://blogs3/posts-list.html",
  title: "Posts",
  description:
    "List of blog posts with draft/published badges, tags and dates. Selecting a post opens its preview.",
  view: "posts",
  invoking: "Loading posts…",
  invoked: "Posts ready",
};

export const BLOG_APPS = [POST_PREVIEW_APP, POSTS_LIST_APP] as const;

/** `_meta` for a tool whose results the app renders. */
export function appToolMeta(app: BlogApp) {
  return {
    ui: { resourceUri: app.uri },
    // Earlier drafts of SEP-1865 used a flat key; some hosts still read it.
    "ui/resourceUri": app.uri,
    "openai/outputTemplate": app.uri,
    // Lets the ChatGPT widget call tools (get_post, ...) itself.
    "openai/widgetAccessible": true,
    "openai/toolInvocation/invoking": app.invoking,
    "openai/toolInvocation/invoked": app.invoked,
  };
}

/**
 * `_meta` for an app's resource. The page loads nothing itself; images in
 * a post may come from any https host, so only images are allowed from
 * outside.
 */
export function appResourceMeta(app: BlogApp) {
  return {
    ui: {
      csp: { connectDomains: [], resourceDomains: ["https:"] },
      prefersBorder: true,
    },
    "openai/widgetDescription": app.description,
    "openai/widgetPrefersBorder": true,
    "openai/widgetCSP": { connect_domains: [], resource_domains: ["https:"] },
  };
}

/** Registers each app's `ui://` resource. The HTML holds no user data. */
export function registerBlogApps(server: McpServer) {
  for (const app of BLOG_APPS) {
    server.registerResource(
      app.name,
      app.uri,
      {
        title: app.title,
        description: app.description,
        mimeType: MCP_APP_MIME_TYPE,
        _meta: appResourceMeta(app),
      },
      async (uri) => ({
        contents: [
          {
            uri: uri.href,
            mimeType: MCP_APP_MIME_TYPE,
            text: blogAppHtml(app.view),
            _meta: appResourceMeta(app),
          },
        ],
      }),
    );
  }
}
