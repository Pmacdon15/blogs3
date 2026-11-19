import "server-only";
import { createClerkClient } from "@clerk/nextjs/server";
import { cacheLife, cacheTag } from "next/cache";

/*
 * Clerk user reads. No auth here: the DAL (`src/lib/dal/auth.ts`) decides who
 * is an admin. Cached by argument, so this must not touch the request:
 * `clerkClient()` reads `headers()`, which throws inside `"use cache"`, so we
 * build a client from the secret key instead.
 */

/** The user's primary email, lowercased, cached per user. */
export async function dbGetPrimaryEmail(
  userId: string,
): Promise<string | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(`user-email:${userId}`);
  const client = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  const user = await client.users.getUser(userId);
  const primary = user.emailAddresses.find(
    (email) => email.id === user.primaryEmailAddressId,
  );
  return primary?.emailAddress.toLowerCase() ?? null;
}
