import { defineConfig, devices } from "@playwright/test";
import { ADMIN_STATE } from "./e2e/env";

/*
 * End-to-end tests (e2e/) against a production build: `bun run build`, then
 * `bun run test:e2e` starts `next start` itself. Point E2E_BASE_URL at a
 * running server to skip that.
 *
 * - public, public-mobile: the reading site, with axe (WCAG 2.2 AA) scans
 *   and keyboard checks. Needs only a database seeded with e2e/seed.sql.
 * - editor: the writing and publishing flow in the studio, signed in as an
 *   admin through Clerk's testing tokens. Skipped unless E2E_CLERK_USER_EMAIL
 *   names a user of a real Clerk dev instance (see e2e/README.md).
 */
const port = Number(process.env.E2E_PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`;
// A Chromium already on the machine, instead of `playwright install`'s.
const executablePath = process.env.E2E_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    launchOptions: { executablePath },
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `bun run start --port ${port}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "public",
      testDir: "e2e/public",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "public-mobile",
      testDir: "e2e/public",
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "editor",
      testDir: "e2e/editor",
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], storageState: ADMIN_STATE },
    },
  ],
});
