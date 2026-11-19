import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  neon: vi.fn((url: string) => ({ url })),
  neonConfig: {} as { fetchEndpoint?: (host: string) => string },
}));

vi.mock("@neondatabase/serverless", () => ({
  neon: mocks.neon,
  neonConfig: mocks.neonConfig,
}));

import { resetSqlClient, sql } from "@/db/client";

beforeEach(() => {
  resetSqlClient();
  delete mocks.neonConfig.fetchEndpoint;
});

describe("sql", () => {
  it("needs DATABASE_URL", () => {
    vi.stubEnv("DATABASE_URL", "");
    expect(() => sql()).toThrow("DATABASE_URL is not set");
  });

  it("creates one client per process", () => {
    vi.stubEnv("DATABASE_URL", "postgres://u@ep-1.neon.tech/main");
    const first = sql();
    expect(sql()).toBe(first);
    expect(mocks.neon).toHaveBeenCalledTimes(1);
    expect(mocks.neon).toHaveBeenCalledWith("postgres://u@ep-1.neon.tech/main");
    // Real Neon hosts keep the driver's own endpoint.
    expect(mocks.neonConfig.fetchEndpoint).toBeUndefined();
  });

  it("sends db.localtest.me to the local Neon HTTP proxy", () => {
    vi.stubEnv("DATABASE_URL", "postgres://postgres@db.localtest.me:5432/main");
    sql();
    expect(mocks.neonConfig.fetchEndpoint?.("db.localtest.me")).toBe(
      "http://db.localtest.me:4444/sql",
    );
  });

  it("reads DATABASE_URL again after a reset", () => {
    vi.stubEnv("DATABASE_URL", "postgres://a@one.test/db");
    sql();
    resetSqlClient();
    vi.stubEnv("DATABASE_URL", "postgres://a@two.test/db");
    sql();
    expect(mocks.neon).toHaveBeenLastCalledWith("postgres://a@two.test/db");
  });
});
