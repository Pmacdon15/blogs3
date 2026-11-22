import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClerkClient: vi.fn(),
  getUser: vi.fn(),
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  createClerkClient: mocks.createClerkClient,
}));
vi.mock("next/cache", () => ({
  cacheLife: mocks.cacheLife,
  cacheTag: mocks.cacheTag,
}));

import { dbGetPrimaryEmail } from "@/db/users";

const user = (
  primary: string | null,
  verification: { status: string } | null = { status: "verified" },
) => ({
  primaryEmailAddressId: primary,
  emailAddresses: [
    {
      id: "e1",
      emailAddress: "Other@Example.com",
      verification: { status: "verified" },
    },
    { id: "e2", emailAddress: "Admin@Example.com", verification },
  ],
});

beforeEach(() => {
  vi.stubEnv("CLERK_SECRET_KEY", "sk_test_123");
  mocks.createClerkClient.mockReturnValue({
    users: { getUser: mocks.getUser },
  });
  mocks.getUser.mockResolvedValue(user("e2"));
});

describe("dbGetPrimaryEmail", () => {
  it("returns the primary address, lowercased, cached per user", async () => {
    await expect(dbGetPrimaryEmail("user_1")).resolves.toBe(
      "admin@example.com",
    );
    // Built from the secret key, never from request headers.
    expect(mocks.createClerkClient).toHaveBeenCalledWith({
      secretKey: "sk_test_123",
    });
    expect(mocks.getUser).toHaveBeenCalledWith("user_1");
    expect(mocks.cacheLife).toHaveBeenCalledWith("minutes");
    expect(mocks.cacheTag).toHaveBeenCalledWith("user-email:user_1");
  });

  it("returns null when the primary address is unverified", async () => {
    mocks.getUser.mockResolvedValue(user("e2", { status: "unverified" }));
    await expect(dbGetPrimaryEmail("user_1")).resolves.toBeNull();
  });

  it("returns null when the primary address has no verification", async () => {
    mocks.getUser.mockResolvedValue(user("e2", null));
    await expect(dbGetPrimaryEmail("user_1")).resolves.toBeNull();
  });

  it("returns null without a primary address", async () => {
    mocks.getUser.mockResolvedValue(user(null));
    await expect(dbGetPrimaryEmail("user_1")).resolves.toBeNull();
  });
});
