/**
 * Whether this is local development: `VERCEL_ENV` unset or "development".
 *
 * Auth fails open (no admin list, no OAuth client allowlist) only here.
 * Vercel preview deployments ("preview") and any other value count as
 * production and fail closed: a preview has a public URL, often shares the
 * production database, and anyone can sign up through Clerk.
 */
export function isLocalDevelopment(): boolean {
  const env = process.env.VERCEL_ENV?.trim();
  return !env || env === "development";
}
