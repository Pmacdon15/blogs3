import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AdminMcpPage, { metadata } from "@/app/(admin)/admin/mcp/page";
import { TOOL_CATALOG } from "@/mcp/tool-catalog";

describe("/admin/mcp", () => {
  it("is a static shell: a plain (not async) server component", () => {
    const element = AdminMcpPage();
    expect(element).not.toBeInstanceOf(Promise);
    expect(metadata.title).toBe("Connect an AI assistant");
  });

  it("shows the heading, the server URL, the guides and every tool", () => {
    render(<AdminMcpPage />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Connect an AI assistant",
      }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("mcp-server-url")).toHaveTextContent(
      `${window.location.origin}/api/mcp`,
    );
    for (const name of ["Claude", "ChatGPT", "Other MCP clients"]) {
      expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    }
    const tools = screen.getByRole("heading", {
      name: "What your assistant can do",
    }).parentElement as HTMLElement;
    for (const tool of TOOL_CATALOG) {
      expect(within(tools).getByText(tool.name)).toBeInTheDocument();
    }
  });
});
