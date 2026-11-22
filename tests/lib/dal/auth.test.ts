import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getPrimaryEmail: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("@/db/users", () => ({ dbGetPrimaryEmail: mocks.getPrimaryEmail }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import {
  assertAdmin,
  isAdmin,
  NotAuthorizedError,
  requireAdminAction,
  requireAdminPage,
} from "@/lib/dal/auth";

beforeEach(() => {
  vi.stubEnv("ADMIN_USER_IDS", "");
  vi.stubEnv("ADMIN_EMAILS", "");
  vi.stubEnv("VERCEL_ENV", "");
  mocks.getPrimaryEmail.mockResolvedValue("admin@example.com");
});

describe("isAdmin", () => {
  it("lets any signed-in user in during local development when no admins are listed", async () => {
    await expect(isAdmin("user_1")).resolves.toBe(true);
    vi.stubEnv("VERCEL_ENV", "development");
    await expect(isAdmin("user_1")).resolves.toBe(true);
  });

  it("lets nobody in on production when no admins are listed", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    await expect(isAdmin("user_1")).resolves.toBe(false);
  });

  it("lets nobody in on a preview deployment when no admins are listed", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    await expect(isAdmin("user_1")).resolves.toBe(false);
  });

  it("still lets listed admins in on a preview deployment", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("ADMIN_USER_IDS", "user_1");
    await expect(isAdmin("user_1")).resolves.toBe(true);
    await expect(isAdmin("user_2")).resolves.toBe(false);
  });

  it("matches listed user ids, comma or space separated, any case", async () => {
    vi.stubEnv("ADMIN_USER_IDS", " user_A, user_b\nuser_c ");
    vi.stubEnv("VERCEL_ENV", "production");
    await expect(isAdmin("USER_a")).resolves.toBe(true);
    await expect(isAdmin("user_c")).resolves.toBe(true);
    await expect(isAdmin("user_d")).resolves.toBe(false);
    expect(mocks.getPrimaryEmail).not.toHaveBeenCalled();
  });

  it("matches the primary email against ADMIN_EMAILS", async () => {
    vi.stubEnv("ADMIN_EMAILS", "admin@example.com");
    await expect(isAdmin("user_1")).resolves.toBe(true);
    vi.stubEnv("ADMIN_EMAILS", "someone@example.com other@example.com");
    await expect(isAdmin("user_1")).resolves.toBe(false);
    expect(mocks.getPrimaryEmail).toHaveBeenCalledWith("user_1");
    mocks.getPrimaryEmail.mockResolvedValue(null);
    await expect(isAdmin("user_1")).resolves.toBe(false);
  });
});

describe("assertAdmin", () => {
  it("returns the admin's id", async () => {
    await expect(assertAdmin("user_1")).resolves.toBe("user_1");
  });

  it.each([null, undefined, ""])("throws for no user (%s)", async (userId) => {
    await expect(assertAdmin(userId)).rejects.toBeInstanceOf(
      NotAuthorizedError,
    );
  });

  it("throws for a user who isn't an admin", async () => {
    vi.stubEnv("ADMIN_USER_IDS", "user_2");
    await expect(assertAdmin("user_1")).rejects.toThrow(
      "You don't have permission to edit posts.",
    );
  });
});

describe("NotAuthorizedError", () => {
  it("has a name and a custom message", () => {
    const error = new NotAuthorizedError("nope");
    expect(error.name).toBe("NotAuthorizedError");
    expect(error.message).toBe("nope");
  });
});

describe("requireAdminPage", () => {
  it("returns the signed-in admin", async () => {
    mocks.auth.mockResolvedValue({ userId: "user_1" });
    await expect(requireAdminPage()).resolves.toBe("user_1");
  });

  it("sends signed-out visitors to sign in", async () => {
    mocks.auth.mockResolvedValue({ userId: null });
    await expect(requireAdminPage()).rejects.toThrow("NEXT_REDIRECT /sign-in");
  });

  it("sends signed-in non-admins home", async () => {
    vi.stubEnv("ADMIN_USER_IDS", "user_2");
    mocks.auth.mockResolvedValue({ userId: "user_1" });
    await expect(requireAdminPage()).rejects.toThrow("NEXT_REDIRECT /");
    expect(mocks.redirect).toHaveBeenCalledWith("/");
  });
});

describe("requireAdminAction", () => {
  it("returns the signed-in admin or throws", async () => {
    mocks.auth.mockResolvedValue({ userId: "user_1" });
    await expect(requireAdminAction()).resolves.toBe("user_1");
    mocks.auth.mockResolvedValue({ userId: null });
    await expect(requireAdminAction()).rejects.toBeInstanceOf(
      NotAuthorizedError,
    );
  });
});
