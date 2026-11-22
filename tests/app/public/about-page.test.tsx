import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AboutPage, { metadata } from "@/app/(public)/about/page";

describe("about page", () => {
  it("exports canonical profile metadata", () => {
    expect(metadata).toMatchObject({
      title: "About",
      alternates: { canonical: "/about" },
      openGraph: { type: "profile", url: "/about" },
      twitter: { card: "summary" },
    });
  });

  it("introduces the author with Person JSON-LD", () => {
    const { container } = render(<AboutPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Patrick MacDonald" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Calgary, Alberta")).toBeInTheDocument();
    const jsonLd = container.querySelector(
      'script[type="application/ld+json"]',
    );
    expect(jsonLd?.textContent).toContain('"@type":"Person"');
  });

  it("links to the website, GitHub and LinkedIn in new tabs", () => {
    render(<AboutPage />);
    const links = within(
      screen.getByRole("region", { name: "Find me elsewhere" }),
    ).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "https://www.patmac.ca",
      "https://github.com/Pmacdon15",
      "https://www.linkedin.com/in/patrick-macdonald-231640285",
    ]);
    for (const link of links) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "me noopener noreferrer");
    }
  });
});
