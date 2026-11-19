# Blogs3 — agent rules

Read `node_modules/next/dist/docs/` for this Next.js version before writing code.

## Architecture

- **Public site** `src/app/(public)`: cached with `"use cache"` + `cacheTag` in the
  page's child components. No auth, no session reads.
- **Admin site** `src/app/(admin)/admin`: different look, reads the session only
  inside `<Suspense>` holes, data through `src/lib/dal/*` (auth lives there).
- **Private caching** lives in `src/db/*` read functions (`"use cache"` keyed by args).
- **Mutations**: client `useMutation` → server action (`src/lib/actions/*`) → DAL →
  `updatePostCaches()` (uses `updateTag`). Route handlers (MCP, webhooks) use
  `revalidatePostCaches()` (uses `revalidateTag`). Never call either directly.
- **Client fetching**: TanStack `useQuery` only for client-side fetches (search),
  and hooks always call API routes (`src/app/api/*`).
- **Zod** schemas in `src/lib/schemas.ts` are used on both client and server.
- **MCP** `src/app/api/mcp` exposes every admin action as a tool, plus MCP Apps.

## Page rules (Cache Components)

1. Pages/layouts are Server Components, never `async`, never `await`.
2. Pass promises down; await as low as possible inside `<Suspense>`.
3. Each hole has a sized skeleton; headings and labels stay in the static shell.
4. Never export `dynamic`, `revalidate`, `fetchCache` or `runtime`.
5. Shared layouts never read request data on the server.

## Checks

`bun run lint` (Biome, no suppressions), `bun run typecheck`, `bun run test`
(100% coverage), `bun run test:build`.
