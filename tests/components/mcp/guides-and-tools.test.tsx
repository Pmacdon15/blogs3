import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CONNECT_GUIDES, ConnectGuides } from "@/components/mcp/connect-guides";
import { ToolList } from "@/components/mcp/tool-list";
import { TOOL_CATALOG } from "@/mcp/tool-catalog";

describe("ConnectGuides", () => {
  it("numbers each client's steps", () => {
    render(<ConnectGuides />);
    for (const guide of CONNECT_GUIDES) {
      const section = screen.getByRole("region", { name: guide.name });
      expect(within(section).getAllByRole("listitem")).toHaveLength(
        guide.steps.length,
      );
    }
    expect(screen.getByRole("region", { name: "Claude" })).toHaveTextContent(
      "Add custom connector",
    );
  });
});

describe("ToolList", () => {
  it("lists every tool and marks the ones anyone can use", () => {
    render(<ToolList />);
    expect(screen.getAllByRole("listitem")).toHaveLength(TOOL_CATALOG.length);
    const open = TOOL_CATALOG.filter((t) => !t.adminOnly).map((t) => t.name);
    expect(open.sort()).toEqual(["search_published_posts", "whoami"]);
    expect(screen.getAllByText("Anyone signed in")).toHaveLength(open.length);
    const item = screen.getByText("delete_post").closest("li") as HTMLElement;
    expect(item).toHaveTextContent("Permanently deletes a post");
  });
});
