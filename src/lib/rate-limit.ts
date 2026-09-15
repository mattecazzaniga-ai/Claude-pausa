/**
 * Minimal in-memory fixed-window rate limiter. Good enough for a single-instance
 * MVP; swap for a Redis-backed limiter (e.g. Upstash) before scaling horizontally.
 */

const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= limit) return false;

  bucket.count += 1;
  return true;
}

/**
 * Accepts either a real Fetch Request (every plain API route) or the plain
 * header map NextAuth's Credentials provider hands to authorize() — the
 * only caller that doesn't have an actual Request to read.
 */
export function clientIp(source: Request | Record<string, string | undefined> | null | undefined): string {
  const forwarded = source instanceof Request ? source.headers.get("x-forwarded-for") : source?.["x-forwarded-for"];
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}
