import 'server-only';
import { env } from '@/lib/env';

/**
 * Guard used by every `app/api/cron/*` route. Rejects with 401 unless the
 * incoming request carries `x-cron-secret` matching `env.CRON_SECRET`.
 *
 * Throws so callers can early-return a `NextResponse.json(...)`. We keep the
 * error opaque on purpose — secret-probing attempts get nothing useful back.
 */
export function assertCronSecret(req: Request): void {
  const header = req.headers.get('x-cron-secret');
  if (!env.CRON_SECRET) {
    throw new CronAuthError('cron_secret_unset');
  }
  if (!header || header !== env.CRON_SECRET) {
    throw new CronAuthError('unauthorized');
  }
}

export class CronAuthError extends Error {
  constructor(public readonly code: 'cron_secret_unset' | 'unauthorized') {
    super(code);
    this.name = 'CronAuthError';
  }
}
