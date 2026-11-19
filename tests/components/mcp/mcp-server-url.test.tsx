import { act, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MCP_PATH, McpServerUrl } from "@/components/mcp/mcp-server-url";

describe("McpServerUrl", () => {
  const writeText = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
  });
  afterEach(() => {
    writeText.mockReset();
  });

  it("shows this site's MCP URL and copies it", async () => {
    writeText.mockResolvedValue(undefined);
    render(<McpServerUrl />);
    const url = screen.getByTestId("mcp-server-url");
    expect(url).toHaveTextContent(`${window.location.origin}/api/mcp`);

    const button = screen.getByRole("button", {
      name: "Copy MCP server URL",
    });
    expect(button).toHaveTextContent("Copy URL");
    await act(async () => {
      fireEvent.click(button);
    });
    expect(writeText).toHaveBeenCalledWith(url.textContent);
    expect(button).toHaveTextContent("Copied");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Copied the MCP server URL.",
    );

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(button).toHaveTextContent("Copy URL");
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("says when copying fails", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    render(<McpServerUrl />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button"));
    });
    expect(screen.getByRole("status")).toHaveTextContent("Couldn't copy");
    expect(screen.getByRole("button")).toHaveTextContent("Copy URL");
  });

  it("renders just the path on the server", () => {
    expect(renderToString(<McpServerUrl />)).toContain(`>${MCP_PATH}</code>`);
  });
});
