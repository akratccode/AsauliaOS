import 'server-only';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { env } from '@/lib/env';

type Limiter = {
  limit: (key: string) => Promise<{ success: boolean; remaining: number; reset: number }>;
};

function buildLimiter(tokens: number, window: `${number} ${'s' | 'm' | 'h'}`): Limiter {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    return {
      async limit() {
        return { success: true, remaining: tokens, reset: Date.now() + 60_000 };
      },
    };
  }

  const redis = new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });

  const rl = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(tokens, window),
    analytics: false,
    prefix: 'asaulia:rl',
  });

  return {
    async limit(key: string) {
      const result = await rl.limit(key);
      return { success: result.success, remaining: result.remaining, reset: result.reset };
    },
  };
}

export const loginLimiter = buildLimiter(5, '10 m');
export const passwordResetLimiter = buildLimiter(3, '1 h');
