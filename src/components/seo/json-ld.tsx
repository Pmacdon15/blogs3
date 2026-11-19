import { serializeJsonLd } from "@/lib/seo";

/** Renders schema.org structured data in an inline JSON-LD script tag. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json">{serializeJsonLd(data)}</script>;
}
