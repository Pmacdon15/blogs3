import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updateTag: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("next/cache", () => ({
  updateTag: mocks.updateTag,
  revalidateTag: mocks.revalidateTag,
}));

import { revalidatePostCaches, updatePostCaches } from "@/lib/cache/revalidate";

const change = { id: "p1", slugs: ["hello"] };
const tags = ["posts:published", "posts:admin", "post:p1", "post-slug:hello"];

describe("updatePostCaches (server actions)", () => {
  it("updates every tag the change touches", () => {
    updatePostCaches(change);
    expect(mocks.updateTag.mock.calls.map(([tag]) => tag)).toEqual(tags);
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
  });
});

describe("revalidatePostCaches (route handlers)", () => {
  it("expires every tag the change touches right away", () => {
    revalidatePostCaches(change);
    expect(mocks.revalidateTag.mock.calls).toEqual(
      tags.map((tag) => [tag, { expire: 0 }]),
    );
    expect(mocks.updateTag).not.toHaveBeenCalled();
  });
});
