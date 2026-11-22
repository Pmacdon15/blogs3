# Blogs

A personal blog platform with a fast, cached public reading site, a private block-based writing studio, and a built-in **Model Context Protocol (MCP)** server so you can draft, edit, upload images, and publish posts directly from AI assistants like Claude and ChatGPT.

- **Public site** (`/`, `/blog/[slug]`): an airy, cached reading experience with instant search as you type, RSS/Atom/JSON feeds, sitemaps, and OpenGraph images.
- **Admin studio** (`/admin`): a structured block editor (headings, paragraphs, images, syntax-highlighted code) with drafts, one-click publishing, and image uploads to Vercel Blob.
- **MCP server** (`/api/mcp`): exposes every admin action as an OAuth-authenticated MCP tool, plus interactive **MCP Apps** (`ui://` resources) that render rich post previews and post lists directly inside the AI chat window.

Built with Next.js 16 (App Router, Cache Components, React Compiler, typed routes), React 19, Clerk, Neon Postgres (serverless HTTP driver), Vercel Blob, TanStack Query, Zod 4, Tailwind CSS v4, Biome, and Vitest, run with Bun.

Released into the public domain under [The Unlicense](LICENSE) — free for anyone to use, modify, or redistribute for any purpose under any circumstance.

---

## Table of Contents

1. [Deploying Your Own Instance (Vercel + Neon + Clerk + Blob + MCP)](#deploying-your-own-instance-vercel--neon--clerk--blob--mcp)
   - [1. Deploy to Vercel](#1-deploy-to-vercel)
   - [2. Set Up Neon Postgres](#2-set-up-neon-postgres)
   - [3. Set Up Vercel Blob (Image Uploads)](#3-set-up-vercel-blob-image-uploads)
   - [4. Set Up Clerk Authentication & Admin Access](#4-set-up-clerk-authentication--admin-access)
   - [5. Enable Clerk OAuth for MCP](#5-enable-clerk-oauth-for-mcp)
   - [6. Customize Your Site Branding](#6-customize-your-site-branding)
2. [How to Use Your Blog](#how-to-use-your-blog)
   - [Writing & Publishing in the Web Studio (`/admin`)](#writing--publishing-in-the-web-studio-admin)
   - [Writing & Publishing from AI Assistants via MCP](#writing--publishing-from-ai-assistants-via-mcp)
   - [Available MCP Tools & Prompts](#available-mcp-tools--prompts)
3. [Local Development](#local-development)
4. [Environment Variables Reference](#environment-variables-reference)
5. [Architecture](#architecture)
6. [Scripts & Testing](#scripts--testing)
7. [License](#license)

---

## Deploying Your Own Instance (Vercel + Neon + Clerk + Blob + MCP)

Everything in this project is designed to run on Vercel with managed integrations for **Neon Postgres**, **Vercel Blob**, and **Clerk**.

### 1. Deploy to Vercel

1. Fork or clone this repository and push it to your GitHub, GitLab, or Bitbucket account.
2. In the [Vercel Dashboard](https://vercel.com/new), import the repository.
3. Keep the default Next.js framework preset (Vercel automatically uses `bun` from `package.json` and `bun.lock`).

### 2. Set Up Neon Postgres

1. In your Vercel project, go to **Storage → Create Database** (or **Marketplace**) and add the **Neon Postgres** integration.
2. Connecting Neon automatically sets `DATABASE_URL` in your Vercel environments.
3. Apply [`schema.sql`](schema.sql) once to create the `posts` table and indexes. You can paste the contents of `schema.sql` into the **Neon SQL Editor** in the Neon/Vercel dashboard, or run it locally against your production connection string:

   ```sh
   DATABASE_URL="postgres://..." bun run db:schema
   ```

   `schema.sql` is idempotent (`create table if not exists`), so it is always safe to re-run.

### 3. Set Up Vercel Blob (Image Uploads)

1. In your Vercel project, go to **Storage → Create Database → Blob** and create a **Public** Blob store.
2. Connect it to your project (`Production`, `Preview`, and `Development`).
3. Vercel automatically sets `BLOB_READ_WRITE_TOKEN`. Images uploaded from `/admin` or the `upload_image` MCP tool are validated (magic bytes, MIME type: PNG, JPEG, WebP, GIF, AVIF, max 4 MB) and stored under `posts/*` on `*.public.blob.vercel-storage.com`.

### 4. Set Up Clerk Authentication & Admin Access

1. Add the **Clerk** integration from the Vercel Marketplace, or create an application at [dashboard.clerk.com](https://dashboard.clerk.com).
2. Make sure `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` are set in your Vercel project's Environment Variables.
3. **Grant yourself admin permissions**:
   - On every Vercel deployment (`VERCEL_ENV=production` or `preview`), admin access **fails closed** by default so strangers who sign up through Clerk cannot edit your blog. Preview deployments have public URLs and often share the production database, so they are treated like production.
   - Set `ADMIN_EMAILS` to your email address (e.g. `ADMIN_EMAILS=you@example.com`) or set `ADMIN_USER_IDS` to your Clerk User ID (`user_...`) in Vercel's Environment Variables. Both accept comma- or space-separated lists.

### 5. Enable Clerk OAuth for MCP

The MCP server at `/api/mcp` authenticates AI clients using **OAuth 2.1 with Dynamic Client Registration** powered by Clerk (`/.well-known/oauth-protected-resource` points clients directly to your Clerk instance). No long-lived API keys are needed.

1. In the **Clerk Dashboard**, open your application and ensure **OAuth / Dynamic Client Registration** is enabled so MCP clients (Claude, ChatGPT, Cursor, etc.) can register themselves and request the `profile`, `email`, and `offline_access` scopes.
2. In your Vercel Environment Variables, set `MCP_ALLOWED_OAUTH_CLIENT_IDS`:
   - Like admin access, this **fails closed in production** when unset.
   - Set `MCP_ALLOWED_OAUTH_CLIENT_IDS=*` to allow any OAuth client where you sign in with your Clerk account (the DAL still verifies that the signed-in user is in `ADMIN_EMAILS` / `ADMIN_USER_IDS` before any private read or write).
   - Or set it to a comma-separated list of specific Clerk OAuth client IDs (`client_...`) once your AI client has registered.
3. _(Optional)_ If you enable RFC 8707 OAuth token audience claims in the Clerk dashboard, you can set `MCP_TOKEN_AUDIENCE=enforce` to require tokens to carry `aud: https://<your-domain>/api/mcp`. By default it is `log` in production and `off` elsewhere.

Redeploy your Vercel project after saving your environment variables.

### 6. Customize Your Site Branding

Update the constants at the top of [`src/lib/seo.ts`](src/lib/seo.ts) to make the blog your own:

- `SITE_NAME`: your blog's title (used in headers, JSON-LD, feeds, OpenGraph images, and PWA manifest).
- `SITE_DESCRIPTION` & `SITE_TAGLINE`: subtitle and hero copy on the home page.
- `SITE_THEME_COLOR` & `SITE_BACKGROUND_COLOR`: brand colors.

If you use a custom domain outside Vercel's automatic `VERCEL_PROJECT_PRODUCTION_URL`, set `NEXT_PUBLIC_SITE_URL=https://your-domain.com`.

---

## How to Use Your Blog

### Writing & Publishing in the Web Studio (`/admin`)

1. Visit `https://<your-domain>/admin` (or click **Studio** in the top navigation bar) and sign in with your admin Clerk account.
2. Click **New post** (`/admin/posts/new`) to open the editor:
   - **Title & Slug**: enter a title; the URL slug is generated automatically (and can be edited).
   - **Excerpt & Tags**: add a short summary for post cards/SEO and up to 10 tags.
   - **Cover Image**: upload an image file (stored in Vercel Blob) or paste an `https://` image URL.
   - **Content Blocks**: build your post out of structured blocks:
     - **Heading**: section titles (`h2` or `h3`).
     - **Text**: prose paragraphs (separate paragraphs with a blank line).
     - **Image**: uploaded image or URL with alt text and an optional caption.
     - **Code**: syntax-highlighted code snippet with a language selector.
   - Reorder blocks at any time using the move up/down controls.
3. Click **Save draft** to save privately without publishing, or **Publish** to make the post live immediately at `/blog/<slug>`.
4. Published posts can be edited, unpublished back to a draft, or deleted from `/admin/posts/[id]`. Every save automatically invalidates the exact Next.js cache tags so your changes appear right away.

### Writing & Publishing from AI Assistants via MCP

Visit `https://<your-domain>/admin/mcp` on your deployed blog for an interactive connection guide with your live MCP server URL:

```text
https://<your-domain>/api/mcp
```

#### Connect Claude (claude.ai or Claude Desktop)

1. Open **Settings → Connectors** on claude.ai or in the Claude desktop app and choose **Add custom connector**.
2. Name it **Blogs** and paste `https://<your-domain>/api/mcp`.
3. Click **Connect** and sign in with your blog's Clerk account when prompted.
4. In any chat, enable the connector from the **+** menu and ask:
   - _"List my drafts"_
   - _"Draft a post about Next.js Cache Components"_
   - _"Upload this diagram, add it after the second heading, and publish the post"_

#### Connect ChatGPT

1. Open **Settings → Apps & Connectors**, turn on **Developer mode** under Advanced, and choose **Create**.
2. Name it **Blogs**, paste `https://<your-domain>/api/mcp`, and select **OAuth** for authentication.
3. Save and sign in with your blog account when prompted.
4. Pick **Blogs** from the tools menu in chat. When tools return posts or post lists, ChatGPT and MCP-App-capable hosts render interactive in-chat previews.

#### Connect Other MCP Clients (Cursor, Windsurf, VS Code, etc.)

Add a remote **Streamable HTTP** MCP server pointing to `https://<your-domain>/api/mcp`. The client discovers OAuth 2.1 metadata via `/.well-known/oauth-protected-resource/api/mcp`, registers dynamically, and opens your browser to sign in.

### Available MCP Tools & Prompts

| Tool / Prompt            | Access             | What it does                                                                                                                            |
| ------------------------ | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `whoami`                 | Any signed-in user | Shows your Clerk user ID and whether you have blog admin permissions.                                                                   |
| `search_published_posts` | Any signed-in user | Searches published posts by title, excerpt, and tags (renders the posts-list MCP App).                                                  |
| `list_posts`             | Admin only         | Lists all posts (including drafts), newest edit first, optionally filtered by `draft` or `published`.                                   |
| `get_post`               | Admin only         | Fetches a post (draft or published) by ID or slug, including every block and its block ID (renders the post-preview MCP App).           |
| `create_post`            | Admin only         | Creates a new draft post with title, optional slug, excerpt, tags, cover image, and blocks.                                             |
| `update_post`            | Admin only         | Updates a post's title, slug, excerpt, tags, cover image, or replaces its full block list.                                              |
| `add_block`              | Admin only         | Inserts a `heading`, `text`, `image`, or `code` block at the end or at a zero-based index.                                              |
| `update_block`           | Admin only         | Updates a single block in place by its block ID from `get_post`.                                                                        |
| `remove_block`           | Admin only         | Removes a single block by its block ID.                                                                                                 |
| `move_block`             | Admin only         | Moves a block to a new zero-based position.                                                                                             |
| `publish_post`           | Admin only         | Publishes a draft post (requires at least one content block) and invalidates public caches.                                             |
| `unpublish_post`         | Admin only         | Converts a published post back into a private draft.                                                                                    |
| `delete_post`            | Admin only         | Permanently deletes a post (requires explicit confirmation with `confirm: true`).                                                       |
| `upload_image`           | Admin only         | Uploads a PNG, JPEG, WebP, GIF, or AVIF image (< 4 MB) from an `https://` URL or base64 data to Vercel Blob and returns its public URL. |
| Prompt: `draft_post`     | Admin workflow     | Guides the AI to propose an outline, write structured blocks, save a draft, and iterate with you before publishing.                     |
| Prompt: `review_post`    | Admin workflow     | Reads an existing post block-by-block, suggests improvements (clarity, structure, code, alt text), and applies accepted edits.          |

---

## Local Development

You need [Bun](https://bun.sh) and Docker.

```sh
# 1. Install dependencies
bun install

# 2. Copy the example environment file
cp .env.example .env.local

# 3. Start local Postgres 17 + Neon's local HTTP proxy
export LOCAL_DB_PASSWORD="$(openssl rand -hex 16)"
docker compose up -d
printf 'DATABASE_URL=postgres://postgres:%s@db.localtest.me:5432/main\n' "$LOCAL_DB_PASSWORD" >> .env.local

# 4. Fill in NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY in .env.local
#    (and BLOB_READ_WRITE_TOKEN if testing image uploads)

# 5. Start the Next.js dev server
bun run dev
```

[`docker-compose.yml`](docker-compose.yml) runs Postgres 17 behind [`local-neon-http-proxy`](https://github.com/TimoWilhelm/local-neon-http-proxy) and automatically applies [`schema.sql`](schema.sql) on first boot. Because `db.localtest.me` resolves to `127.0.0.1`, [`src/db/client.ts`](src/db/client.ts) routes the Neon serverless HTTP driver to `http://db.localtest.me:4444/sql` so local development works offline identically to production.

In local development only (`VERCEL_ENV` unset or `development`), leaving `ADMIN_USER_IDS` and `ADMIN_EMAILS` empty makes any signed-in Clerk user an admin automatically.

To re-apply the database schema at any time:

```sh
bun run db:schema
```

---

## Environment Variables Reference

| Variable                            | Required          | Description                                                                                                                                                                                                                                                                    |
| ----------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`                      | Yes               | Neon Postgres connection string (or `postgres://postgres:<pw>@db.localtest.me:5432/main` locally). Set automatically by the Vercel Neon integration.                                                                                                                           |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes               | Clerk publishable key (`pk_test_...` or `pk_live_...`). Also used to derive the OAuth issuer URL for MCP discovery.                                                                                                                                                            |
| `CLERK_SECRET_KEY`                  | Yes               | Clerk secret key (`sk_test_...` or `sk_live_...`).                                                                                                                                                                                                                             |
| `BLOB_READ_WRITE_TOKEN`             | Yes (for uploads) | Vercel Blob read/write token for storing uploaded cover and post images.                                                                                                                                                                                                       |
| `ADMIN_EMAILS`                      | In production     | Comma- or space-separated primary email addresses allowed to use `/admin` and MCP admin tools.                                                                                                                                                                                 |
| `ADMIN_USER_IDS`                    | In production     | Comma- or space-separated Clerk user IDs (`user_...`) allowed to use `/admin` and MCP admin tools. (Provide `ADMIN_EMAILS`, `ADMIN_USER_IDS`, or both. If both are empty, everyone signed in is an admin in local development and **nobody** is on Vercel, previews included.) |
| `MCP_ALLOWED_OAUTH_CLIENT_IDS`      | In production     | Comma- or space-separated OAuth client IDs allowed to call `/api/mcp`, or `*` to allow any OAuth client. If unset, any client is allowed in local development and **none** on Vercel, previews included.                                                                       |
| `MCP_TOKEN_AUDIENCE`                | Optional          | `off`, `log`, or `enforce` for validating RFC 8707 `aud` claims (`https://<domain>/api/mcp`) on Clerk OAuth tokens. Defaults to `off` in local development and `log` on Vercel (production and preview).                                                                       |
| `NEXT_PUBLIC_SITE_URL`              | Optional          | Canonical origin (e.g. `https://blog.example.com`) for sitemaps, feeds, and OpenGraph URLs when not using `VERCEL_PROJECT_PRODUCTION_URL`.                                                                                                                                     |

---

## Architecture

### Static shell first

`cacheComponents` is enabled in [`next.config.ts`](next.config.ts), so `next build` prerenders every page. Pages follow strict rules (enforced by AST and build tests — see [`AGENTS.md`](AGENTS.md)):

- Pages and layouts are synchronous Server Components: never `async`, never `await`, never `"use client"`.
- Request data (`params`, `searchParams`, the session) is passed down as a promise and awaited as low as possible inside `<Suspense>` with a sized skeleton. Headings and labels stay in the static shell.
- No route segment config (`dynamic`, `revalidate`, `fetchCache`, `runtime`).
- Layouts never read request data. The user menu is a client component (`useAuth()` from Clerk), so public pages build fully static.

The result: public pages that read no URL build as **○ static**, pages that do build as **◐ partial** with a real HTML shell, and no page is **ƒ dynamic**. `src/app/(public)/shell-check` is a canary with `export const ensureStatic = "navigation"`: the build fails if anything in the root or public layout starts reading request data.

### Caching

| Where                             | What                                                                                                                                           | How it's invalidated   |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Public pages (`src/app/(public)`) | `"use cache"` components with `cacheTag(CACHE_TAGS.publishedPosts)` / `CACHE_TAGS.postSlug(slug)` around the public reads in `src/db/posts.ts` | Any post change        |
| Private reads (`src/db/posts.ts`) | `dbListAllPosts`, `dbGetPostById` cache themselves, keyed by their arguments and tagged `posts:admin` / `post:<id>`                            | The post's own changes |

Every tag lives in [`src/lib/cache/tags.ts`](src/lib/cache/tags.ts); nothing uses raw tag strings. Invalidation goes through two functions in [`src/lib/cache/revalidate.ts`](src/lib/cache/revalidate.ts):

- **Server actions** (`src/lib/actions/*`) call `updatePostCaches(change)`, which uses `updateTag`: the editor reads its own write on the next render.
- **Route handlers** (the MCP server, webhooks) call `revalidatePostCaches(change)`, which uses `revalidateTag(tag, { expire: 0 })`.

### Data flow

```text
browser ── useMutation ──▶ server action ──▶ DAL (src/lib/dal) ──▶ db (src/db)
                                │                 │
                                │                 └─ checks the admin, validates with zod
                                └─ updatePostCaches(change)

AI app ── MCP tools/call ──▶ /api/mcp ──▶ DAL ──▶ db
                                 └─ revalidatePostCaches(change)

search box ── useQuery ──▶ /api/posts/search ──▶ db (published posts only)
```

- **DAL** (`src/lib/dal`): the only way to read drafts or write. Every function takes the caller's user ID first (from the Clerk session, or the verified OAuth token for MCP), checks that they are an admin, validates input with the shared Zod schemas in [`src/lib/schemas.ts`](src/lib/schemas.ts), and returns a `Result`.
- **Zod everywhere**: the editor validates with the same schemas before calling an action, and the server parses again.
- **TanStack Query**: used only for client-side fetching (such as live search), calling API routes (`src/app/api/*`).

---

## Scripts & Testing

| Script                                               | What it does                                                         |
| ---------------------------------------------------- | -------------------------------------------------------------------- |
| `bun run dev`                                        | Start the Next.js development server                                 |
| `bun run build` / `bun run start`                    | Production build / production server                                 |
| `bun run lint`                                       | Biome check with safe and unsafe fixes                               |
| `bun run format`                                     | Biome format                                                         |
| `bun run typecheck`                                  | `next typegen` + `tsc --noEmit`                                      |
| `bun run test`                                       | Run every Vitest project (build checks skip without a `.next` build) |
| `bun run test:unit` / `test:components` / `test:app` | Run a single Vitest project                                          |
| `bun run test:coverage`                              | Run tests with 100% coverage enforcement                             |
| `bun run test:build`                                 | Run `next build`, then verify the prerendered static shells          |
| `bun run db:schema`                                  | Apply `schema.sql` to `$DATABASE_URL`                                |
| `bun run e2e:seed`                                   | Load the Playwright fixture posts (`e2e/seed.sql`)                   |
| `bun run test:e2e`                                   | Playwright: editor + publishing flow and WCAG 2.2 AA (axe) checks    |

### Vitest Projects (`vitest.config.mts`)

- **unit**: `tests/*.test.*`, `tests/lib`, `tests/hooks`, `tests/unit`. Includes `tests/unit/app/route-files.test.ts`, which parses every page, layout, template, default, and not-found file under `src/app` with the TypeScript compiler and fails on `"use client"`, an `async` component, an `await` in the component body, route segment config, `ensureStatic = false`, or a layout that touches `auth`, `currentUser`, `cookies`, `headers`, or Clerk's `<Show>`.
- **components**: `tests/components`.
- **app**: `tests/app`. `tests/app/static-shell.test.tsx` renders every page like the build does (`params` and `searchParams` never resolve, cached reads resolve at once) and checks that the shell has an `<h1>` and visible text and never asked Clerk for the session.
- **build** (node): `tests/build/static-shell.test.ts` inspects `.next` after `next build`: no page is ƒ dynamic, `/`, `/sign-in`, `/sign-up`, and `/shell-check` are ○ static, every ◐ partial page has an `<h1>` in its shell, and every page under `ensureStatic = "navigation"` is ○.

Coverage must stay at **100%** (lines, branches, functions, statements) for everything in `src` except `coverage.exclude`.

### End-to-end and accessibility (`e2e/`, Playwright)

Runs against a production build (`bun run build`, then `bun run test:e2e`). The **public** and **public-mobile** projects scan every kind of public page with axe-core for WCAG 2.2 A/AA and check keyboard access, visible focus, search announcements and 320px reflow. The **editor** project walks a post through the studio (write a draft → validation errors → preview → publish → edit → unpublish → delete) with axe scans along the way; it needs a Clerk development instance and runs only when `E2E_CLERK_USER_EMAIL` is set. See [`e2e/README.md`](e2e/README.md) and [`docs/accessibility.md`](docs/accessibility.md).

---

## License

This project is released into the public domain under **[The Unlicense](LICENSE)**. Anyone is free to copy, modify, publish, use, compile, sell, or distribute this software for any purpose, commercial or non-commercial, and under any circumstance.
