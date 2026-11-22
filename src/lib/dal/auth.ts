import "server-only";
import { auth } from "@clerk/nextjs/server";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { cache } from "react";
import { dbGetPrimaryEmail } from "@/db/users";
import { isLocalDevelopment } from "@/lib/deployment";

/*
 * Who may edit. Auth is only checked for editing and for unpublished posts;
 * public pages never touch the session.
 *
 * Admins are users listed in ADMIN_USER_IDS, or whose primary email is in
 * ADMIN_EMAILS (both comma/space separated). With both empty, every signed-in
 * user is an admin in local development only, and nobody is on any Vercel
 * deployment, previews included (fail closed: anyone can sign up through
 * Clerk).
 */

function parseList(raw: string | undefined) {
  return (raw ?? "")
    .split(/[\s,]+/)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export async function isAdmin(userId: string): Promise<boolean> {
  const ids = parseList(process.env.ADMIN_USER_IDS);
  const emails = parseList(process.env.ADMIN_EMAILS);
  if (ids.length === 0 && emails.length === 0) {
    return isLocalDevelopment();
  }
  if (ids.includes(userId.toLowerCase())) return true;
  if (emails.length === 0) return false;
  const email = await dbGetPrimaryEmail(userId);
  return email !== null && emails.includes(email);
}

export class NotAuthorizedError extends Error {
  constructor(message = "You don't have permission to edit posts.") {
    super(message);
    this.name = "NotAuthorizedError";
  }
}

/** Throws NotAuthorizedError unless `userId` is an admin. Used by every DAL write/private read. */
export async function assertAdmin(userId: string | null | undefined) {
  if (!userId || !(await isAdmin(userId))) throw new NotAuthorizedError();
  return userId;
}

/**
 * For admin pages (inside a Suspense hole): the signed-in admin's id.
 * Signed out → /sign-in; signed in but not an admin → home page.
 */
export const requireAdminPage = cache(async () => {
  const { userId } = await auth();
  // The sign-in page is an optional catch-all, so its root needs the cast.
  if (!userId) redirect("/sign-in" as Route);
  if (!(await isAdmin(userId))) redirect("/");
  return userId;
});

/** For server actions: the signed-in admin's id, or NotAuthorizedError. */
export async function requireAdminAction() {
  const { userId } = await auth();
  return assertAdmin(userId);
}
