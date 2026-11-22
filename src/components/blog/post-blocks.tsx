import Image from "next/image";
import { CodeSnippet } from "@/components/blog/code-snippet";
import { InlineText } from "@/components/blog/inline-text";
import type { Block } from "@/lib/schemas";

/** Images on our Blob store go through next/image; any other host is shown as-is. */
export function isBlobUrl(url: string) {
  return new URL(url).hostname.endsWith(".public.blob.vercel-storage.com");
}

/** Splits text into paragraphs keyed by where each starts, so keys stay stable. */
export function paragraphs(text: string) {
  const parts: { key: number; text: string }[] = [];
  let offset = 0;
  for (const part of text.split(/(\n{2,})/)) {
    if (part.trim() && !/^\n+$/.test(part))
      parts.push({ key: offset, text: part });
    offset += part.length;
  }
  return parts;
}

/*
 * Renders a post body. Server-safe (no hooks), so the public page, the admin
 * preview and anything else can share it. Text is rendered as text (React
 * escapes it), never as HTML; text blocks support inline **bold**, *italic*,
 * `code` and [links](url).
 */
export function PostBlocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="prose prose-lg prose-slate max-w-none prose-headings:scroll-mt-24 prose-headings:font-semibold prose-headings:tracking-tight prose-a:text-brand-600 prose-pre:bg-transparent prose-pre:p-0">
      {blocks.map((block) => (
        <PostBlock block={block} key={block.id} />
      ))}
    </div>
  );
}

export function PostBlock({ block }: { block: Block }) {
  switch (block.type) {
    case "heading":
      return <h2 id={block.id}>{block.text}</h2>;
    case "text":
      return (
        <>
          {paragraphs(block.text).map((paragraph) => (
            <p className="whitespace-pre-line" key={paragraph.key}>
              <InlineText text={paragraph.text} />
            </p>
          ))}
        </>
      );
    case "image": {
      const resized = block.width !== undefined && block.width < 100;
      return (
        <figure
          className={resized ? "mx-auto" : undefined}
          style={resized ? { width: `${block.width}%` } : undefined}
        >
          <Image
            alt={block.alt}
            className="h-auto w-full rounded-2xl border border-line"
            height={900}
            sizes="(min-width: 768px) 720px, 100vw"
            src={block.url}
            unoptimized={!isBlobUrl(block.url)}
            width={1600}
          />
          {block.caption ? (
            <figcaption className="text-center">{block.caption}</figcaption>
          ) : null}
        </figure>
      );
    }
    case "code":
      return <CodeSnippet code={block.code} language={block.language} />;
  }
}
