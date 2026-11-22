# End-to-end tests

Playwright against a production build of the site, with
[axe-core](https://github.com/dequelabs/axe-core) checking WCAG 2.2 A/AA.

| Project         | What it covers                                                                                                             | Needs                      |
| --------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `public`        | axe on every kind of public page; skip link; visible focus on every tab stop; keyboard search; 320px reflow; drafts hidden | a database with `seed.sql` |
| `public-mobile` | the same on a Pixel 7 viewport (keyboard-only checks skip)                                                                 | the same                   |
| `editor`        | a post's whole life in the studio, with axe scans: draft → errors → preview → publish → edit → unpublish → delete          | a Clerk dev instance       |

## Running locally

```bash
docker compose up -d
```

```bash
bun run e2e:seed
```

```bash
bun run build
```

```bash
bun run test:e2e
```

`test:e2e` starts `next start` on port 3100 (`E2E_PORT`), or set `E2E_BASE_URL`
to test a server that's already running. `E2E_CHROMIUM_PATH` points
Playwright at a Chromium already on the machine instead of the one
`bunx playwright install chromium` downloads.

The fixture posts in `seed.sql` must be loaded **before** `next build`: the
home page's post list is prerendered.

## The editor tests

The studio is behind Clerk, so the editor project signs in for real through
[Clerk's testing tokens](https://clerk.com/docs/testing/playwright/overview)
(`@clerk/testing`). It runs only when `E2E_CLERK_USER_EMAIL` is set, and needs:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` from a Clerk
  **development** instance (testing tokens don't exist on production ones),
  set before `bun run build`;
- `E2E_CLERK_USER_EMAIL`: a user of that instance, signed in by email with a
  sign-in token, so no password is stored anywhere;
- that user to be an admin: list the same address in `ADMIN_EMAILS` (or leave
  `ADMIN_EMAILS` and `ADMIN_USER_IDS` empty locally, where every signed-in user
  is an admin).

In CI the `End-to-end and accessibility` job reads the repository secrets
`E2E_CLERK_PUBLISHABLE_KEY`, `E2E_CLERK_SECRET_KEY` and `E2E_CLERK_USER_EMAIL`.
Without them (forks, or not set up yet) the editor project is skipped and the
public projects run with placeholder keys.

Each run creates its own post (`e2e-post-<timestamp>`) and deletes it at the
end. The steps share that post, so the file runs in order (`serial`).

## Without a Clerk instance

With placeholder keys, Clerk's middleware would send every page load on a
"development" instance to the (non-existent) Frontend API for a handshake.
`fixtures.ts` gives the browser a dev-browser cookie and `__client_uat=0`
instead, so the middleware treats it as signed out on its own, and drops the
requests for clerk-js. The public site never reads the session, so nothing
else changes.

## Writing tests

Import `test` and `expect` from `./fixtures`, and call `expectAccessible()`
whenever the page is in a state worth scanning (a dialog open, errors shown,
results listed). Each scan's results are attached to the test report.
