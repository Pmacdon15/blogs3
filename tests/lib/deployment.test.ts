import { afterEach, describe, expect, it, vi } from "vitest";
import { isLocalDevelopment } from "@/lib/deployment";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isLocalDevelopment", () => {
  it("is true when VERCEL_ENV is unset, empty or development", () => {
    vi.stubEnv("VERCEL_ENV", undefined);
    expect(isLocalDevelopment()).toBe(true);
    vi.stubEnv("VERCEL_ENV", "");
    expect(isLocalDevelopment()).toBe(true);
    vi.stubEnv("VERCEL_ENV", " development ");
    expect(isLocalDevelopment()).toBe(true);
  });

  it("is false on production, preview and any other deployment", () => {
    for (const env of ["production", "preview", "staging"]) {
      vi.stubEnv("VERCEL_ENV", env);
      expect(isLocalDevelopment()).toBe(false);
    }
  });
});
