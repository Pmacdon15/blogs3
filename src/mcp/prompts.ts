import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

/*
 * MCP prompts: ready-made flows that show up in AI clients as slash commands
 * or a prompt picker. Each one only builds instructions for the model, which
 * then calls the blog's tools; prompts touch no data themselves.
 *
 * Prompt arguments are always strings, and all of them are optional: the AI
 * asks for, or works out, anything the user leaves out.
 */

export const draftPostArgsSchema = z.object({
  topic: z.string().optional().describe("What the post is about."),
  audience: z
    .string()
    .optional()
    .describe("Who it's for, e.g. 'beginners' or 'senior engineers'."),
  tone: z
    .string()
    .optional()
    .describe("How it should sound, e.g. 'friendly' or 'formal'."),
});

export type DraftPostArgs = z.infer<typeof draftPostArgsSchema>;

export function draftPostPromptText(args: DraftPostArgs): string {
  const topic = args.topic?.trim();
  const audience = args.audience?.trim();
  const tone = args.tone?.trim();
  return [
    topic
      ? `Draft a blog post about ${topic} for my blog.`
      : "Help me draft a new blog post. Ask me what it should be about.",
    audience ? `It's for ${audience}.` : null,
    tone ? `Keep the tone ${tone}.` : null,
    "",
    "Steps:",
    "1. Propose a title, a one-sentence excerpt, up to 5 lowercase tags and a short outline. Wait for my OK or changes.",
    "2. Write the post as blocks: heading blocks for sections, text blocks for paragraphs (plain text, blank line between paragraphs), code blocks with a language for any code, and image blocks only for images I give you (upload them with upload_image first).",
    "3. Call create_post with the title, excerpt, tags and blocks. It saves a draft; show me the preview.",
    "4. Apply my edits with update_block, add_block, remove_block, move_block or update_post.",
    "5. Only call publish_post when I say to publish.",
  ]
    .filter((line) => line !== null)
    .join("\n");
}

export const reviewPostArgsSchema = z.object({
  post: z.string().optional().describe("The post's title, slug or id."),
});

export type ReviewPostArgs = z.infer<typeof reviewPostArgsSchema>;

export function reviewPostPromptText(args: ReviewPostArgs): string {
  const which = args.post?.trim();
  return [
    which
      ? `Review my blog post "${which}".`
      : "Review one of my blog posts. Ask me which one (list_posts shows them).",
    "",
    "Steps:",
    "1. Find the post with list_posts or get_post (by slug or id) and read every block.",
    "2. Suggest concrete improvements: a clearer title and excerpt, structure and headings, wording, typos, code correctness and missing alt text on images.",
    "3. List the changes block by block and ask which to apply.",
    "4. Apply only the ones I accept, with update_block, add_block, remove_block, move_block or update_post. Don't publish or unpublish unless I ask.",
  ].join("\n");
}

const userMessage = (text: string) => ({
  messages: [
    { role: "user" as const, content: { type: "text" as const, text } },
  ],
});

export function registerBlogPrompts(server: McpServer) {
  server.registerPrompt(
    "draft_post",
    {
      title: "Draft a blog post",
      description:
        "Plans and writes a new post with you, saves it as a draft and shows the preview. Publishes only when you say so.",
      argsSchema: draftPostArgsSchema,
    },
    (args) => userMessage(draftPostPromptText(args)),
  );

  server.registerPrompt(
    "review_post",
    {
      title: "Review a blog post",
      description:
        "Reads one of your posts, suggests improvements block by block and applies the ones you accept.",
      argsSchema: reviewPostArgsSchema,
    },
    (args) => userMessage(reviewPostPromptText(args)),
  );
}
