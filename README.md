# Blogs3

A blog with a public reading site, a private writing studio, and an MCP
server so you can write and publish from an AI app (Claude, ChatGPT, ...).

- **Public site** (`/`, `/blog/[slug]`): an airy, cached reading experience
  with search as you type.
- **Admin studio** (`/admin`): a block editor (headings, text, images, code)
  with drafts, publishing and image uploads to Vercel Blob.
- **MCP server** (`/api/mcp`): every admin action as a tool, plus in-chat
  apps that preview posts and lists inside the AI host.

Built with Next.js 16 (App Router, Cache Components, React Compiler, typed
routes), React 19, Clerk, Neon Postgres (HTTP driver), TanStack Query, zod 4,
Tailwind CSS v4, Biome and Vitest, run with bun.

## Architecture

### Static shell first

`cacheComponents` is on, so `next build` prerenders every page. Pages follow
a few rules (see [AGENTS.md](AGENTS.md)):

- Pages and layouts are synchronous Server Components: never `async`, never
  `await`, never `"use client"`.
- Request data (`params`, `searchParams`, the session) is passed down as a
  promise and awaited as low as possible, inside its own `<Suspense>` with a
  skeleton sized like the content. Headings and labels stay outside, in the
  static shell.
- No route segment config (`dynamic`, `revalidate`, `fetchCache`, `runtime`).
- Layouts never read the request. The user menu is a client component
  (`useAuth()` from Clerk), so the public pages build fully static.

The result: public pages that read no URL build as **○ static**, pages that
do build as **◐ partial** with a real shell, and no page is **ƒ dynamic**.
`src/app/(public)/shell-check` is a canary with
`export const ensureStatic = "navigation"`: the build fails if anything in
the root or public layout starts reading request data.

### Caching

| Where                             | What                                                                                                                                           | How it's invalidated   |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Public pages (`src/app/(public)`) | `"use cache"` components with `cacheTag(CACHE_TAGS.publishedPosts)` / `CACHE_TAGS.postSlug(slug)` around the public reads in `src/db/posts.ts` | any post change        |
| Private reads (`src/db/posts.ts`) | `dbListAllPosts`, `dbGetPostById` cache themselves, keyed by their arguments and tagged `posts:admin` / `post:<id>`                            | the post's own changes |

Every tag lives in `src/lib/cache/tags.ts`; nothing uses raw tag strings.
Invalidation goes through two functions in `src/lib/cache/revalidate.ts`:

- **Server actions** (`src/lib/actions/*`) call `updatePostCaches(change)`,
  which uses `updateTag`: the editor reads its own write on the next render.
- **Route handlers** (the MCP server, webhooks) can't use `updateTag`, so
  they call `revalidatePostCaches(change)`, which uses
  `revalidateTag(tag, { expire: 0 })`.

### Data flow

```
browser ── useMutation ──▶ server action ──▶ DAL (src/lib/dal) ──▶ db (src/db)
                                │                 │
                                │                 └─ checks the admin, validates with zod
                                └─ updatePostCaches(change)

AI app ── MCP tools/call ──▶ /api/mcp ──▶ DAL ──▶ db
                                 └─ revalidatePostCaches(change)

search box ── useQuery ──▶ /api/posts/search ──▶ db (published posts only)
```

- **DAL** (`src/lib/dal`): the only way to read drafts or write. Every
  function takes the caller's user id first (from the Clerk session, or the
  verified OAuth token for MCP), checks it is an admin, validates input with
  the shared zod schemas in `src/lib/schemas.ts`, and returns a `Result`.
- **Zod everywhere**: the editor validates with the same schemas before it
  calls an action, and the server parses again.
- **TanStack Query** is only for client-side fetching, and those hooks only
  call API routes (`src/app/api/*`).
- **Auth**: Clerk. Admin pages read the session inside a `<Suspense>` hole
  (`requireAdminPage`); `src/proxy.ts` also sends signed-out visitors from
  `/admin` to sign in. Admins are listed in `ADMIN_USER_IDS` / `ADMIN_EMAILS`.

### MCP and MCP Apps

`/api/mcp` is a streamable-HTTP MCP server. Clients sign the user in with
Clerk OAuth (discovered through `/.well-known/oauth-protected-resource`), and
every tool runs as that verified user through the same DAL as the studio:
`whoami`, `list_posts`, `get_post`, `search_published_posts`, `create_post`,
`update_post`, the block tools (`add_block`, `update_block`, `remove_block`,
`move_block`), `publish_post`, `unpublish_post`, `delete_post` and
`upload_image`.

Tools that return posts link an **MCP App** (`ui://` resources of type
`text/html;profile=mcp-app`, also wired for the OpenAI Apps SDK): a post
preview and a posts list rendered inside the AI host. Hosts without app
support just use the text result. `/admin/mcp` shows how to connect.

## Local development

You need [bun](https://bun.sh) and Docker.

```sh
bun install
docker compose up -d          # Postgres 17 + Neon's local HTTP proxy (schema.sql runs on first start)
cp .env.example .env.local    # then fill it in (below)
bun run dev
```

`docker-compose.yml` runs Postgres behind
[local-neon-http-proxy](https://github.com/TimoWilhelm/local-neon-http-proxy),
so the Neon serverless driver works offline exactly as in production. Point
`DATABASE_URL` at `db.localtest.me` (which resolves to 127.0.0.1); the db
client (`src/db/client.ts`) sends that host to the proxy on port 4444:

```sh
export LOCAL_DB_PASSWORD="$(openssl rand -hex 16)"
docker compose up -d
printf 'DATABASE_URL=%s://%s:%s@%s/main\n' \
  postgres postgres "$LOCAL_DB_PASSWORD" db.localtest.me:5432 >> .env.local
```

To re-apply the schema to any database: `bun run db:schema`.

### Environment variables

| Variable                                                | What it is for                                                                                                                                                            |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                          | Neon (or the local proxy above). Set by the Vercel Neon integration.                                                                                                      |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Clerk. Set by the Vercel Clerk integration.                                                                                                                               |
| `BLOB_READ_WRITE_TOKEN`                                 | Vercel Blob, for image uploads.                                                                                                                                           |
| `ADMIN_USER_IDS`, `ADMIN_EMAILS`                        | Who may use `/admin` and the MCP write tools (comma or space separated). With both empty, any signed-in user is an admin outside production, and nobody is in production. |
| `MCP_ALLOWED_OAUTH_CLIENT_IDS`                          | OAuth client ids allowed to call the MCP server (`*` for any). Unset means any client outside production and none in production.                                          |

## Scripts

| Script                                               | What it does                                                         |
| ---------------------------------------------------- | -------------------------------------------------------------------- |
| `bun run dev`                                        | Next dev server                                                      |
| `bun run build` / `bun run start`                    | Production build / server                                            |
| `bun run lint`                                       | Biome check with safe and unsafe fixes                               |
| `bun run format`                                     | Biome format                                                         |
| `bun run typecheck`                                  | `next typegen` + `tsc --noEmit`                                      |
| `bun run test`                                       | Every Vitest project (the build checks skip without a `.next` build) |
| `bun run test:unit` / `test:components` / `test:app` | One Vitest project                                                   |
| `bun run test:coverage`                              | Tests with coverage (100% required)                                  |
| `bun run test:build`                                 | `next build`, then checks the build output                           |
| `bun run db:schema`                                  | Applies `schema.sql` to `$DATABASE_URL`                              |

## Tests

Vitest projects (`vitest.config.mts`), jsdom unless noted:

- **unit**: `tests/*.test.*`, `tests/lib`, `tests/hooks`, `tests/unit`.
  Includes `tests/unit/app/route-files.test.ts`, which parses every page,
  layout, template, default and not-found file under `src/app` with the
  TypeScript compiler and fails (saying what to do) on `"use client"`, an
  async component, an `await` in the component body, route segment config,
  `ensureStatic = false`, or a layout that touches `auth`, `currentUser`,
  `cookies`, `headers` or Clerk's `<Show>`.
- **components**: `tests/components`.
- **app**: `tests/app`. `tests/app/static-shell.test.tsx` renders every page
  like the build does (params and searchParams never resolve, cached reads
  resolve at once) and checks the shell has an `<h1>` and visible text and
  never asked Clerk for the session. Helpers for page tests live in
  `tests/helpers/render-page.tsx`.
- **build** (node): `tests/build/static-shell.test.ts` reads `.next` after
  `next build`: no page is ƒ, `/`, `/sign-in`, `/sign-up` and `/shell-check`
  are ○, every ◐ page has an `<h1>` in its shell, and every page under
  `ensureStatic = "navigation"` is ○. It skips without a build unless
  `REQUIRE_BUILD=1`.

New pages are discovered from disk, so these checks cover them without
editing a test. Coverage must stay at 100% (lines, branches, functions,
statements) for everything in `src` except `coverage.exclude`.

### CI (`.github/workflows`)

- **tests.yml**: the unit, components and app projects run as parallel jobs
  (`COVERAGE_SHARD=1`, blob reports); a Coverage job merges them, enforces
  100% and runs `scripts/check-untested-files.ts` (fails for any source file
  no test loads). A Static shell job starts Postgres and the Neon HTTP proxy
  as services, applies `schema.sql` and runs `bun run test:build`.
- **biome.yml**: on PRs from this repo, Biome applies its fixes and commits
  them as a signed "style: apply Biome fixes" commit, then re-runs the
  checks; `biome ci --error-on-warnings` must pass (errors and warnings).
  Suppression comments aren't used.
- **typecheck.yml**: `bun run typecheck`.
- **audit.yml**: `bun audit`, failing on high and critical advisories.
