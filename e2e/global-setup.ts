import { clerkSetup } from "@clerk/testing/playwright";
import { editorEnabled } from "./env";

/*
 * With a real Clerk dev instance, fetch a testing token so the browser can
 * sign in without bot protection getting in the way. It lands in
 * CLERK_FAPI / CLERK_TESTING_TOKEN, which the workers inherit.
 */
export default async function globalSetup() {
  if (editorEnabled) await clerkSetup();
}
