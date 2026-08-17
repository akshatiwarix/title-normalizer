/**
 * An in-memory per-IP token bucket, shared by both routes.
 *
 * Deliberately not a database: this is a portfolio deployment, the limit exists to
 * stop one bored visitor from spending the project's model quota, and a process-local
 * counter that resets on a cold start is the honest amount of infrastructure for
 * that. It lives outside `lib/normalize/` because it holds state and reads a clock,
 * and the engine is not allowed to do either.
 */

type Bucket = { count: number; resetAt: number };

const WINDOW_MS = 60_000;
const buckets = new Map<string, Bucket>();

export type RateLimitVerdict = { allowed: boolean; remaining: number; retryAfterSeconds: number };

export function rateLimit(key: string, limitPerMinute: number): RateLimitVerdict {
  const now = Date.now();
  const existing = buckets.get(key);

  if (existing === undefined || now >= existing.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: limitPerMinute - 1, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  const remaining = Math.max(0, limitPerMinute - existing.count);
  const retryAfterSeconds = Math.ceil((existing.resetAt - now) / 1000);

  return { allowed: existing.count <= limitPerMinute, remaining, retryAfterSeconds };
}

/** Best-effort client identity. Behind Vercel this is the real client IP. */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || request.headers.get("x-real-ip") || "unknown";
}
