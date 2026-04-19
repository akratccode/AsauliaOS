'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

type NavKey =
  | 'overview'
  | 'brands'
  | 'contractors'
  | 'matrix'
  | 'finances'
  | 'payouts'
  | 'invoices'
  | 'audit'
  | 'config';

const ITEMS: ReadonlyArray<{ href: string; key: NavKey }> = [
  { href: '/admin', key: 'overview' },
  { href: '/admin/brands', key: 'brands' },
  { href: '/admin/contractors', key: 'contractors' },
  { href: '/admin/contractors/matrix', key: 'matrix' },
  { href: '/admin/finances', key: 'finances' },
  { href: '/admin/finances/payouts', key: 'payouts' },
  { href: '/admin/finances/invoices', key: 'invoices' },
  { href: '/admin/audit', key: 'audit' },
  { href: '/admin/config', key: 'config' },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const t = useTranslations('nav.admin');
  return (
    <nav
      aria-label={t('label')}
      className="border-fg-4/10 bg-bg-1 hidden w-56 shrink-0 flex-col gap-1 border-r p-4 md:flex"
    >
      {/* eslint-disable-next-line i18next/no-literal-string -- brand name */}
      <div className="text-asaulia-blue-soft mb-3 px-2 font-serif text-lg italic">Asaulia</div>
      <div className="text-fg-3 mb-2 px-2 text-[10px] uppercase tracking-[0.12em]">
        {t('label')}
      </div>
      {ITEMS.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== '/admin' && pathname?.startsWith(`${item.href}/`)) ||
          false;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-md px-3 py-2 text-sm ${
              active
                ? 'bg-asaulia-blue/20 text-fg-1'
                : 'text-fg-2 hover:text-fg-1 hover:bg-bg-2'
            }`}
          >
            {t(item.key)}
          </Link>
        );
      })}
    </nav>
  );
}
