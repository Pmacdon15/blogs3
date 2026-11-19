import { describe, expect, it } from "vitest";
import { formatDate } from "@/lib/format-date";

describe("formatDate", () => {
  it("formats in UTC with a fixed locale", () => {
    expect(formatDate("2026-11-19T10:00:00.000Z")).toBe("Nov 19, 2026");
  });

  it("doesn't shift the day near midnight UTC", () => {
    expect(formatDate("2026-01-01T00:00:00.000Z")).toBe("Jan 1, 2026");
    expect(formatDate("2025-12-31T23:59:59.000Z")).toBe("Dec 31, 2025");
  });
});
