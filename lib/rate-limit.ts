import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// ── Per-function rate limiters ────────────────────────────────────────────────

/** Main aiSearch action: 10 requests per 60s (global, not per-user yet) */
export const aiSearchLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "60 s"),
  prefix: "ratelimit:aiSearch",
});

/** AI identifyEntity calls (expensive): 5 per 60s */
export const identifyEntityLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "60 s"),
  prefix: "ratelimit:identifyEntity",
});

/** TMDB fetch calls: 30 per 60s */
export const tmdbLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "60 s"),
  prefix: "ratelimit:tmdb",
});

export async function checkLimit(
  limiter: Ratelimit,
  identifier: string = "global",
): Promise<{ allowed: boolean; retryAfter: number }> {
  const { success, reset } = await limiter.limit(identifier);
  if (success) return { allowed: true, retryAfter: 0 };
  const retryAfter = Math.ceil((reset - Date.now()) / 1000);
  return { allowed: false, retryAfter };
}
