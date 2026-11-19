import { describe, expect, it } from "vitest";
import { cn } from "@/lib/cn";

describe("cn", () => {
  it("joins conditional classes", () => {
    expect(cn("a", false, null, undefined, { b: true, c: false }, ["d"])).toBe(
      "a b d",
    );
  });

  it("lets later Tailwind classes win", () => {
    expect(cn("px-2 text-sm", "px-4")).toBe("text-sm px-4");
  });
});
