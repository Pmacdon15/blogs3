import { clerk } from "@clerk/testing/playwright";
import { expect, test as setup } from "@playwright/test";
import {
  ADMIN_STATE,
  adminEmail,
  editorEnabled,
  editorSkipReason,
} from "./env";

/* Signs in once as the admin and saves the session for the editor project. */
setup("sign in as the admin", async ({ page }) => {
  setup.skip(!editorEnabled, editorSkipReason);
  // Clerk has to load on an unprotected page before signing in.
  await page.goto("/");
  await clerk.signIn({ page, emailAddress: adminEmail });
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { level: 1, name: "Posts" }),
  ).toBeVisible();
  await page.context().storageState({ path: ADMIN_STATE });
});
