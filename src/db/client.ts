import {
  type NeonQueryFunction,
  neon,
  neonConfig,
} from "@neondatabase/serverless";

/*
 * One Neon HTTP client per process, created on first use so importing this
 * module (during `next build`, or in tests) never needs DATABASE_URL.
 *
 * CI and local runs point DATABASE_URL at `db.localtest.me`, served by
 * Neon's local HTTP proxy in front of a plain Postgres (see
 * docker-compose.yml and .github/workflows/tests.yml).
 */
const LOCAL_HOST = "db.localtest.me";

let client: NeonQueryFunction<false, false> | undefined;

export function sql() {
  if (client) return client;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  if (new URL(url).hostname === LOCAL_HOST) {
    neonConfig.fetchEndpoint = (host) => `http://${host}:4444/sql`;
  }
  client = neon(url);
  return client;
}

/** For tests: forget the client so the next call reads DATABASE_URL again. */
export function resetSqlClient() {
  client = undefined;
}
