import { defaultLocale, isLocale, type Locale } from '@/i18n/routing';

export function detectInitialLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return defaultLocale;
  const entries = acceptLanguage
    .split(',')
    .map((part) => {
      const [tagRaw, ...params] = part.trim().split(';');
      const tag = tagRaw?.trim().toLowerCase();
      let q = 1;
      for (const p of params) {
        const [k, v] = p.trim().split('=');
        if (k === 'q' && v) {
          const parsed = Number(v);
          if (!Number.isNaN(parsed)) q = parsed;
        }
      }
      return { tag: tag ?? '', q };
    })
    .filter((e) => e.tag.length > 0)
    .sort((a, b) => b.q - a.q);

  for (const { tag } of entries) {
    if (isLocale(tag)) return tag;
    const base = tag.split('-')[0];
    if (base && isLocale(base)) return base;
  }
  return defaultLocale;
}
