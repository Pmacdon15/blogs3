import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { JsonLd } from "@/components/seo/json-ld";

describe("JsonLd", () => {
  it("renders a JSON-LD script tag with `<` escaped", () => {
    const html = renderToStaticMarkup(
      <JsonLd data={{ "@type": "WebSite", name: "Blogs </script>" }} />,
    );
    expect(html).toBe(
      '<script type="application/ld+json">{"@type":"WebSite","name":"Blogs \\u003c/script>"}</script>',
    );
  });
});
