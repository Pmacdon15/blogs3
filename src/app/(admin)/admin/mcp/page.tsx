import type { Metadata } from "next";
import { ConnectGuides } from "@/components/mcp/connect-guides";
import { McpServerUrl } from "@/components/mcp/mcp-server-url";
import { ToolList } from "@/components/mcp/tool-list";

export const metadata: Metadata = { title: "Connect an AI assistant" };

/*
 * How to use the blog from Claude, ChatGPT or any MCP client. Fully static:
 * the server URL is built in the browser from the site's own origin.
 */
export default function AdminMcpPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <header>
        <h1 className="font-semibold text-2xl text-ink tracking-tight">
          Connect an AI assistant
        </h1>
        <p className="mt-1 max-w-2xl text-muted text-sm">
          Write, edit and publish posts from Claude, ChatGPT or any app that
          supports the Model Context Protocol (MCP). Everything you can do in
          the studio works there too, and posts show up as in-chat previews.
        </p>
      </header>

      <section
        aria-labelledby="mcp-url"
        className="rounded-xl border border-line bg-surface p-5 shadow-xs"
      >
        <h2 className="font-semibold text-ink text-lg" id="mcp-url">
          MCP server URL
        </h2>
        <p className="mt-1 mb-3 text-muted text-sm">
          Add this URL to your assistant, then sign in with your blog account.
          No API key needed.
        </p>
        <McpServerUrl />
      </section>

      <section aria-labelledby="mcp-steps" className="flex flex-col gap-3">
        <h2 className="font-semibold text-ink text-lg" id="mcp-steps">
          Set it up
        </h2>
        <ConnectGuides />
      </section>

      <section aria-labelledby="mcp-tools" className="flex flex-col gap-3">
        <h2 className="font-semibold text-ink text-lg" id="mcp-tools">
          What your assistant can do
        </h2>
        <ToolList />
        <p className="text-muted text-sm">
          Prompts: <code className="font-mono">draft_post</code> plans and
          writes a new draft with you, and{" "}
          <code className="font-mono">review_post</code> suggests edits to an
          existing post. Deleting always needs your explicit confirmation.
        </p>
      </section>
    </div>
  );
}
