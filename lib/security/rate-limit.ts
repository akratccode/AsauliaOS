import 'server-only';

/**
 * In-memory token bucket. Fine for a single-region Vercel deploy where each
 * route-handler container serves traffic independently; abuse is caught in
 * aggregate by upstream (Stripe/Shopify) rate limits anyway. For true
 * cross-region sharing, swap this with Upstash in a future phase.
 *
 * Key by actor identifier (user id, brand id, or IP) + scope name.
 */
type Bucket = { tokens: number; updatedAt: number };
const buckets = new Map<string, Bucket>();

export type RateLimitConfig = {
  limit: number; // max requests
  windowMs: number; // sliding window
};

export function rateLimit(
  key: string,
  scope: string,
  config: RateLimitConfig,
): { allowed: boolean; retryAfterMs: number } {
  const bucketKey = `${scope}:${key}`;
  const now = Date.now();
  const b = buckets.get(bucketKey);
  const refillPerMs = config.limit / config.windowMs;

  if (!b) {
    buckets.set(bucketKey, { tokens: config.limit - 1, updatedAt: now });
    return { allowed: true, retryAfterMs: 0 };
  }

  const elapsed = now - b.updatedAt;
  const refilled = Math.min(config.limit, b.tokens + elapsed * refillPerMs);

  if (refilled < 1) {
    const needed = 1 - refilled;
    const retryAfterMs = Math.ceil(needed / refillPerMs);
    return { allowed: false, retryAfterMs };
  }

  b.tokens = refilled - 1;
  b.updatedAt = now;
  return { allowed: true, retryAfterMs: 0 };
}

export const RATE_LIMITS = {
  DELIVERABLES_POST: { limit: 60, windowMs: 60_000 },
  SHOPIFY_INSTALL: { limit: 5, windowMs: 60_000 },
  CHAT_POST: { limit: 30, windowMs: 60_000 },
} as const;

/** Test-only — reset the bucket map so suites don't share state. */
export function _resetRateLimitsForTests(): void {
  buckets.clear();
}
