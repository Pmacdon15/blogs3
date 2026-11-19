import { describe, expect, it } from "vitest";
import { CACHE_TAGS, postChangeTags } from "@/lib/cache/tags";

describe("CACHE_TAGS", () => {
  it("names every tag in one place", () => {
    expect(CACHE_TAGS.publishedPosts).toBe("posts:published");
    expect(CACHE_TAGS.adminPosts).toBe("posts:admin");
    expect(CACHE_TAGS.post("p1")).toBe("post:p1");
    expect(CACHE_TAGS.postSlug("hello")).toBe("post-slug:hello");
  });
});

describe("postChangeTags", () => {
  it("covers the lists, the post and each distinct slug", () => {
    expect(postChangeTags({ id: "p1", slugs: ["old", "new", "old"] })).toEqual([
      "posts:published",
      "posts:admin",
      "post:p1",
      "post-slug:old",
      "post-slug:new",
    ]);
  });
});
