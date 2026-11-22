/*
 * A small fixed-window rate limiter, kept in memory.
 *
 * Each server instance counts on its own (Vercel's Fluid compute reuses an
 * instance across many requests, so this catches a single client hammering
 * an endpoint, not a distributed flood). For a limit shared by every
 * instance, add a rate-limit rule in the Vercel Firewall as well.
 */

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Seconds until the window resets. */
  resetSeconds: number;
};

export type RateLimiter = {
  /** Counts one request for `key` and says whether it is within the limit. */
  consume(key: string, now?: number): RateLimitResult;
  /** Whether `key` is already over the limit, without counting a request. */
  peek(key: string, now?: number): RateLimitResult;
};

export type RateLimitOptions = {
  /** Requests allowed per window. */
  limit: number;
  windowMs: number;
  /** Most keys tracked at once, so memory stays bounded. */
  maxKeys?: number;
};

type Window = { count: number; resetAt: number };

export function createRateLimiter({
  limit,
  windowMs,
  maxKeys = 10_000,
}: RateLimitOptions): RateLimiter {
  const windows = new Map<string, Window>();

  function current(key: string, now: number): Window {
    const existing = windows.get(key);
    if (existing && existing.resetAt > now) return existing;
    if (existing) windows.delete(key);
    return { count: 0, resetAt: now + windowMs };
  }

  function makeRoom(now: number) {
    for (const [key, window] of windows) {
      if (window.resetAt <= now) windows.delete(key);
    }
    // Still full: drop the oldest keys (a Map iterates in insertion order).
    for (const key of windows.keys()) {
      if (windows.size < maxKeys) break;
      windows.delete(key);
    }
  }

  function result(window: Window, now: number): RateLimitResult {
    return {
      allowed: window.count <= limit,
      limit,
      remaining: Math.max(0, limit - window.count),
      resetSeconds: Math.max(1, Math.ceil((window.resetAt - now) / 1000)),
    };
  }

  return {
    consume(key, now = Date.now()) {
      const window = current(key, now);
      if (!windows.has(key)) {
        if (windows.size >= maxKeys) makeRoom(now);
        windows.set(key, window);
      }
      window.count += 1;
      return result(window, now);
    },
    peek(key, now = Date.now()) {
      const window = current(key, now);
      return { ...result(window, now), allowed: window.count < limit };
    },
  };
}

/**
 * The caller's IP address. Vercel sets `x-real-ip` and `x-forwarded-for`
 * itself, overwriting whatever the client sent; elsewhere (local runs) the
 * first `x-forwarded-for` hop is the best guess.
 */
export function clientIp(req: Request): string {
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "unknown";
}

/** `RateLimit-*` (IETF draft) and `Retry-After` headers for a result. */
export function rateLimitHeaders(result: RateLimitResult) {
  const headers: Record<string, string> = {
    "RateLimit-Limit": String(result.limit),
    "RateLimit-Remaining": String(result.remaining),
    "RateLimit-Reset": String(result.resetSeconds),
  };
  if (!result.allowed) headers["Retry-After"] = String(result.resetSeconds);
  return headers;
}

/** A 429 that is never cached, with the limit's headers. */
export function tooManyRequests(
  result: RateLimitResult,
  body: Record<string, unknown> = {
    error: "Too many requests. Try again shortly.",
  },
) {
  return Response.json(body, {
    status: 429,
    headers: { ...rateLimitHeaders(result), "Cache-Control": "no-store" },
  });
}
