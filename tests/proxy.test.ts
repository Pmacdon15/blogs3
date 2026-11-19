// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@clerk/nextjs/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@clerk/nextjs/server")>()),
  // Hand back the handler itself so the test can call it directly.
  clerkMiddleware: (handler: unknown) => handler,
}));

import { config, proxy } from "@/proxy";

type Handler = (
  auth: { protect: () => Promise<void> },
  req: NextRequest,
) => Promise<void>;

const run = async (path: string) => {
  const auth = { protect: vi.fn(async () => {}) };
  await (proxy as unknown as Handler)(
    auth,
    new NextRequest(`https://example.test${path}`),
  );
  return auth.protect;
};

describe("proxy", () => {
  it.each(["/admin", "/admin/posts", "/admin/posts/123/edit"])(
    "makes %s sign in",
    async (path) => {
      expect(await run(path)).toHaveBeenCalledTimes(1);
    },
  );

  it.each(["/", "/blog/hello", "/sign-in", "/api/posts/search", "/api/mcp"])(
    "leaves %s public",
    async (path) => {
      expect(await run(path)).not.toHaveBeenCalled();
    },
  );
});

describe("proxy matcher", () => {
  const [pages, always] = config.matcher.map((m) => new RegExp(`^${m}$`));
  const matches = (path: string) => pages.test(path) || always.test(path);

  it("runs on pages and API routes", () => {
    for (const path of ["/", "/admin", "/blog/a", "/api/mcp", "/trpc/x"]) {
      expect(matches(path), path).toBe(true);
    }
  });

  it("skips Next internals and static files", () => {
    for (const path of ["/_next/static/chunk.js", "/favicon.ico", "/a.png"]) {
      expect(pages.test(path), path).toBe(false);
    }
  });
});
