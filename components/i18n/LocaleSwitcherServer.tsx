import { readLocale } from '@/lib/i18n/cookie';
import { LocaleSwitcher } from './LocaleSwitcher';

type Props = { variant?: 'default' | 'compact'; className?: string };

export async function LocaleSwitcherServer(props: Props) {
  const currentLocale = await readLocale();
  return <LocaleSwitcher currentLocale={currentLocale} {...props} />;
}
