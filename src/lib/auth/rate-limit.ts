import { db } from "../db";
import { jsonError } from "@/lib/api/respond";

const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_LIMIT = 10;

export interface RateLimitOptions {
  limit?: number;
  windowMs?: number;
}

/** Best-effort client IP from the proxy headers (Vercel/most proxies set x-forwarded-for). */
export function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002";
}

/**
 * Fixed-window counter stored in the RateLimitBucket table, so the budget is
 * shared by every serverless instance. Namespace `key` per endpoint (e.g.
 * "staff-login:<ip>"). Returns true once `key` exceeds `limit` requests in
 * the current window. Fails open on a database error — a rate-limit outage
 * must not lock every user out — and logs only the error code.
 */
export async function isRateLimited(key: string, options: RateLimitOptions = {}): Promise<boolean> {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const windowStart = Math.floor(Date.now() / windowMs) * windowMs;
  const bucketKey = `${key}:${windowStart}`;

  const increment = () =>
    db.rateLimitBucket.upsert({
      where: { key: bucketKey },
      create: { key: bucketKey, count: 1, expiresAt: new Date(windowStart + windowMs) },
      update: { count: { increment: 1 } },
    });

  try {
    let bucket;
    try {
      bucket = await increment();
    } catch (error) {
      // Two first-requests racing to create the same bucket — the loser retries as an update.
      if (!isUniqueViolation(error)) throw error;
      bucket = await increment();
    }
    if (Math.random() < 0.01) {
      void db.rateLimitBucket.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => {});
    }
    return bucket.count > limit;
  } catch (error) {
    console.error("[rate-limit] counter unavailable, allowing request", (error as { code?: string }).code ?? "unknown");
    return false;
  }
}

/** Convenience for route handlers: returns a 429 Response when the caller's IP is over budget for `route`, else null. */
export async function rateLimitByIp(request: Request, route: string, options: RateLimitOptions = {}, message = "Too many requests. Please try again later."): Promise<Response | null> {
  if (await isRateLimited(`${route}:${clientIp(request)}`, options)) {
    return jsonError(429, message);
  }
  return null;
}
