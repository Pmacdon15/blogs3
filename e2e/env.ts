import path from "node:path";

/** The Clerk user the editor tests sign in as. It must be an admin (ADMIN_EMAILS). */
export const adminEmail = process.env.E2E_CLERK_USER_EMAIL ?? "";

/** Whether the editor tests can run: they need a real Clerk dev instance and user. */
export const editorEnabled = adminEmail !== "";

export const editorSkipReason =
  "Set E2E_CLERK_USER_EMAIL and real Clerk dev keys to run the editor tests (see e2e/README.md).";

/** The signed-in admin's cookies, written by auth.setup.ts. Gitignored. */
export const ADMIN_STATE = path.join(__dirname, ".auth/admin.json");

/** Published, draft and second posts from e2e/seed.sql. */
export const FIXTURES = {
  post: {
    slug: "e2e-accessibility-fixture",
    title: "Accessibility fixture",
  },
  second: { slug: "e2e-second-fixture", title: "Second fixture" },
  draft: { slug: "e2e-draft-fixture", title: "Draft fixture" },
} as const;
