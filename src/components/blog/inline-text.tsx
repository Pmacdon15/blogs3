import { type InlineNode, parseInline } from "@/lib/inline-format";

/*
 * Renders a text block's inline formatting (**bold**, *italic*, `code`,
 * [links](url)) as elements. Server-safe; text stays text, never HTML.
 */
export function InlineText({ text }: { text: string }) {
  return <InlineNodes nodes={parseInline(text)} />;
}

function InlineNodes({ nodes }: { nodes: InlineNode[] }) {
  return nodes.map((node) => <Inline key={node.key} node={node} />);
}

function Inline({ node }: { node: InlineNode }) {
  switch (node.type) {
    case "text":
      return node.text;
    case "code":
      return <code>{node.text}</code>;
    case "strong":
      return (
        <strong>
          <InlineNodes nodes={node.children} />
        </strong>
      );
    case "em":
      return (
        <em>
          <InlineNodes nodes={node.children} />
        </em>
      );
    case "link":
      return (
        <a
          href={node.href}
          rel={/^https?:/i.test(node.href) ? "noopener noreferrer" : undefined}
        >
          <InlineNodes nodes={node.children} />
        </a>
      );
  }
}
