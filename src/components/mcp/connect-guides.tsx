import type { ReactNode } from "react";

/*
 * Step-by-step instructions for adding the blog's MCP server to AI apps.
 * Static, so the page keeps a fully static shell.
 */

export type ConnectGuide = {
  id: string;
  name: string;
  steps: { key: string; body: ReactNode }[];
};

export const CONNECT_GUIDES: ConnectGuide[] = [
  {
    id: "claude",
    name: "Claude",
    steps: [
      {
        key: "claude-add",
        body: (
          <>
            Open <strong>Settings → Connectors</strong> on claude.ai or in the
            Claude desktop app and choose <strong>Add custom connector</strong>.
          </>
        ),
      },
      {
        key: "claude-url",
        body: "Name it Blogs and paste the MCP server URL above.",
      },
      {
        key: "claude-sign-in",
        body: "Choose Connect and sign in with your blog account when asked.",
      },
      {
        key: "claude-use",
        body: (
          <>
            In a chat, turn the connector on from the <strong>+</strong> menu
            and ask, for example, “List my drafts” or “Draft a post about
            Next.js caching”.
          </>
        ),
      },
    ],
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    steps: [
      {
        key: "chatgpt-add",
        body: (
          <>
            Open <strong>Settings → Apps &amp; Connectors</strong>, turn on{" "}
            <strong>Developer mode</strong> under Advanced, then choose{" "}
            <strong>Create</strong>.
          </>
        ),
      },
      {
        key: "chatgpt-url",
        body: "Name it Blogs, paste the MCP server URL above and pick OAuth for authentication.",
      },
      {
        key: "chatgpt-sign-in",
        body: "Save, then sign in with your blog account when ChatGPT asks.",
      },
      {
        key: "chatgpt-use",
        body: "In a chat, pick Blogs from the tools menu. Posts show up as in-chat previews.",
      },
    ],
  },
  {
    id: "other",
    name: "Other MCP clients",
    steps: [
      {
        key: "other-add",
        body: "Add a remote (Streamable HTTP) MCP server with the URL above. No API key is needed.",
      },
      {
        key: "other-oauth",
        body: "The client finds the sign-in page by itself (OAuth 2.1 with dynamic client registration) and opens it for you.",
      },
      {
        key: "other-sign-in",
        body: "Sign in with your blog account. Only admins can edit; anyone signed in can search published posts.",
      },
    ],
  },
];

export function ConnectGuides() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {CONNECT_GUIDES.map((guide) => (
        <section
          aria-labelledby={`guide-${guide.id}`}
          className="rounded-xl border border-line bg-surface p-5 shadow-xs"
          key={guide.id}
        >
          <h3
            className="font-semibold text-base text-ink"
            id={`guide-${guide.id}`}
          >
            {guide.name}
          </h3>
          <ol className="mt-3 flex flex-col gap-2.5 text-muted text-sm">
            {guide.steps.map((step, index) => (
              <li className="flex gap-2.5" key={step.key}>
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-50 font-semibold text-brand-700 text-xs"
                >
                  {index + 1}
                </span>
                <span>{step.body}</span>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
