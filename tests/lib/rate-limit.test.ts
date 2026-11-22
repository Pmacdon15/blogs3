import { describe, expect, it } from "vitest";
import {
  clientIp,
  createRateLimiter,
  rateLimitHeaders,
  tooManyRequests,
} from "@/lib/rate-limit";

describe("createRateLimiter", () => {
  it("allows up to the limit per window, then blocks until it resets", () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 1000 });
    expect(limiter.consume("a", 0)).toEqual({
      allowed: true,
      limit: 2,
      remaining: 1,
      resetSeconds: 1,
    });
    expect(limiter.consume("a", 100).allowed).toBe(true);
    const blocked = limiter.consume("a", 200);
    expect(blocked).toMatchObject({ allowed: false, remaining: 0 });
    // Other keys have their own window.
    expect(limiter.consume("b", 200).allowed).toBe(true);
    // A new window starts once the old one has passed.
    expect(limiter.consume("a", 1000)).toMatchObject({
      allowed: true,
      remaining: 1,
    });
  });

  it("peeks without counting", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });
    expect(limiter.peek("a", 0)).toMatchObject({ allowed: true, remaining: 1 });
    expect(limiter.peek("a", 0).allowed).toBe(true);
    limiter.consume("a", 0);
    expect(limiter.peek("a", 500)).toMatchObject({
      allowed: false,
      remaining: 0,
    });
    expect(limiter.peek("a", 1500).allowed).toBe(true);
  });

  it("uses the current time by default", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });
    expect(limiter.consume("a").resetSeconds).toBe(60);
    expect(limiter.peek("a").allowed).toBe(false);
  });

  it("keeps at most maxKeys, dropping expired then oldest keys", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000, maxKeys: 2 });
    limiter.consume("old", 0);
    limiter.consume("newer", 600);
    // "old" has expired by now, so it makes room and "newer" stays counted.
    limiter.consume("third", 1100);
    expect(limiter.peek("newer", 1100).allowed).toBe(false);
    // Nothing has expired: the oldest key ("newer") is dropped.
    limiter.consume("fourth", 1200);
    expect(limiter.peek("newer", 1200).allowed).toBe(true);
    expect(limiter.peek("third", 1200).allowed).toBe(false);
  });
});

describe("clientIp", () => {
  const req = (headers: Record<string, string>) =>
    new Request("http://localhost/", { headers });

  it("prefers x-real-ip, then the first x-forwarded-for hop", () => {
    expect(clientIp(req({ "x-real-ip": " 1.2.3.4 " }))).toBe("1.2.3.4");
    expect(clientIp(req({ "x-forwarded-for": "5.6.7.8, 10.0.0.1" }))).toBe(
      "5.6.7.8",
    );
    expect(clientIp(req({ "x-forwarded-for": " , " }))).toBe("unknown");
    expect(clientIp(req({}))).toBe("unknown");
  });
});

describe("responses", () => {
  const blocked = { allowed: false, limit: 5, remaining: 0, resetSeconds: 30 };

  it("adds Retry-After only when blocked", () => {
    expect(rateLimitHeaders({ ...blocked, allowed: true })).toEqual({
      "RateLimit-Limit": "5",
      "RateLimit-Remaining": "0",
      "RateLimit-Reset": "30",
    });
    expect(rateLimitHeaders(blocked)["Retry-After"]).toBe("30");
  });

  it("answers 429 with a default or custom body, never cached", async () => {
    const res = tooManyRequests(blocked);
    expect(res.status).toBe(429);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("Retry-After")).toBe("30");
    await expect(res.json()).resolves.toEqual({
      error: "Too many requests. Try again shortly.",
    });
    await expect(
      tooManyRequests(blocked, { error: "x" }).json(),
    ).resolves.toEqual({ error: "x" });
  });
});
