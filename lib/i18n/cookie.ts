import 'server-only';
import { cookies } from 'next/headers';
import { locales, defaultLocale, LOCALE_COOKIE, isLocale, type Locale } from '@/i18n/routing';

export async function readLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : defaultLocale;
}

export async function writeLocale(locale: Locale): Promise<void> {
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
}

export { locales };
