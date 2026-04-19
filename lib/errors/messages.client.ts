'use client';

import { useTranslations } from 'next-intl';
import type { ErrorKey } from './messages';

export function useErrorMessage() {
  const t = useTranslations('errors');
  return (key: ErrorKey) => t(key);
}
