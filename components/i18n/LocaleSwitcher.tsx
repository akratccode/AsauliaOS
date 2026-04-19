'use client';

import { useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { locales, type Locale } from '@/i18n/routing';
import { setLocaleAction } from '@/app/actions/locale';

type Props = {
  currentLocale: Locale;
  variant?: 'default' | 'compact';
  className?: string;
};

export function LocaleSwitcher({ currentLocale, variant = 'default', className }: Props) {
  const t = useTranslations('locale');
  const [pending, startTransition] = useTransition();

  const select = (locale: Locale) => {
    if (locale === currentLocale || pending) return;
    const fd = new FormData();
    fd.set('locale', locale);
    startTransition(() => {
      void setLocaleAction(fd);
    });
  };

  const compact = variant === 'compact';

  return (
    <div
      role="group"
      aria-label={t('ariaLabel')}
      className={`border-fg-4/15 bg-bg-1 inline-flex items-center gap-1 rounded-full border p-1 ${compact ? 'text-[11px]' : 'text-xs'} ${className ?? ''}`}
    >
      {locales.map((locale) => {
        const active = locale === currentLocale;
        return (
          <button
            key={locale}
            type="button"
            onClick={() => select(locale)}
            disabled={pending || active}
            aria-pressed={active}
            className={`rounded-full px-3 py-1 uppercase tracking-[0.14em] transition ${
              active
                ? 'bg-asaulia-blue text-fg-1'
                : 'text-fg-3 hover:text-fg-1 disabled:opacity-60'
            }`}
          >
            {t(`short.${locale}`)}
          </button>
        );
      })}
    </div>
  );
}
