"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

export const MCP_PATH = "/api/mcp";

const noSubscription = () => () => {};

/** This site's MCP server URL, built in the browser from its own origin. */
export function useMcpServerUrl() {
  return useSyncExternalStore(
    noSubscription,
    () => `${window.location.origin}${MCP_PATH}`,
    () => MCP_PATH,
  );
}

type CopyState = "idle" | "copied" | "failed";

/** The MCP server URL with a copy button. */
export function McpServerUrl() {
  const url = useMcpServerUrl();
  const [state, setState] = useState<CopyState>("idle");

  useEffect(() => {
    if (state === "idle") return;
    const timer = setTimeout(() => setState("idle"), 2000);
    return () => clearTimeout(timer);
  }, [state]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setState("copied");
    } catch {
      setState("failed");
    }
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <code
        className="min-w-0 flex-1 select-all overflow-x-auto whitespace-nowrap rounded-lg border border-line bg-canvas px-3 py-2.5 font-mono text-ink text-sm"
        data-testid="mcp-server-url"
      >
        {url}
      </code>
      <Button
        // Contains the visible label, so voice control matches it (WCAG 2.5.3).
        aria-label={
          state === "copied" ? "Copied" : "Copy URL of the MCP server"
        }
        className="shrink-0"
        onClick={copy}
        size="md"
      >
        {state === "copied" ? (
          <Check aria-hidden="true" className="size-4" />
        ) : (
          <Copy aria-hidden="true" className="size-4" />
        )}
        {state === "copied" ? "Copied" : "Copy URL"}
      </Button>
      <span aria-live="polite" className="sr-only" role="status">
        {state === "copied"
          ? "Copied the MCP server URL."
          : state === "failed"
            ? "Couldn't copy. Select the URL and copy it yourself."
            : ""}
      </span>
    </div>
  );
}
