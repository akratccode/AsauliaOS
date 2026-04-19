import 'server-only';
import { getTranslations } from 'next-intl/server';

export type ErrorKey =
  | 'generic'
  | 'unauthorized'
  | 'forbidden'
  | 'notFound'
  | 'rateLimit'
  | 'networkError'
  | 'tryAgain'
  | 'validation'
  | 'sessionExpired';

/** Returns a localized, user-facing error message for the given key. */
export async function errorMessage(key: ErrorKey): Promise<string> {
  const t = await getTranslations('errors');
  return t(key);
}
