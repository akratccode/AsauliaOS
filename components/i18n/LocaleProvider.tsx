'use client';

import { NextIntlClientProvider } from 'next-intl';
import type { ComponentProps } from 'react';
import type { Locale } from '@/i18n/routing';

type Props = Omit<ComponentProps<typeof NextIntlClientProvider>, 'locale'> & {
  locale: Locale;
};

export function LocaleProvider(props: Props) {
  return <NextIntlClientProvider {...props} />;
}
