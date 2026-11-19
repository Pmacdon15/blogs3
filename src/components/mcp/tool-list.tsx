import { TOOL_CATALOG } from "@/mcp/tool-catalog";

/** Every MCP tool, with what it does and who can use it. */
export function ToolList() {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface shadow-xs">
      {TOOL_CATALOG.map((tool) => (
        <li
          className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:gap-4"
          key={tool.name}
        >
          <code className="shrink-0 font-mono text-brand-700 text-sm sm:w-56">
            {tool.name}
          </code>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-ink text-sm">
              {tool.title}
              {tool.adminOnly ? null : (
                <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-700 text-xs">
                  Anyone signed in
                </span>
              )}
            </p>
            <p className="text-muted text-sm">{tool.description}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
