/**
 * Minimal in-memory rate limiter, originally built for the staff login
 * endpoint (CLAUDE.md hard rule: "rate-limit auth endpoints") and reused
 * since for any endpoint that needs the same per-key attempt budget — e.g.
 * POST /api/ai/ask (Step 29), a public, real-Claude-API-backed endpoint.
 * Namespace the `key` per caller (e.g. "staff-login:<ip>", "ask-ai:<ip>")
 * so different endpoints don't share the same budget. Works for a single
 * Node.js process — fine for dev/staging or one production instance; move
 * to a shared store (Redis, etc.) before running multiple instances
 * behind a load balancer.
 */
const attempts = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

/** Returns true if `key` has exceeded the attempt budget for the current window. */
export function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}
