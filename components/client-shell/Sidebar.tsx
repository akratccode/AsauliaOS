'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

const ITEMS = [
  { href: '/dashboard', key: 'dashboard' },
  { href: '/deliverables', key: 'deliverables' },
  { href: '/sales', key: 'sales' },
  { href: '/plan', key: 'plan' },
  { href: '/billing', key: 'billing' },
  { href: '/team', key: 'team' },
  { href: '/settings', key: 'settings' },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const tNav = useTranslations('nav');
  const tClient = useTranslations('nav.client');
  return (
    <nav
      aria-label={tNav('sidebarAriaLabel')}
      className="border-fg-4/10 bg-bg-1 hidden w-60 shrink-0 flex-col gap-1 border-r p-4 md:flex"
    >
      {/* eslint-disable-next-line i18next/no-literal-string -- brand name */}
      <div className="text-fg-2 mb-4 px-2 font-serif text-lg italic">Asaulia</div>
      {ITEMS.map((item) => {
        const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-md px-3 py-2 text-sm ${
              active
                ? 'bg-asaulia-blue/15 text-fg-1'
                : 'text-fg-2 hover:text-fg-1 hover:bg-bg-2'
            }`}
          >
            {tClient(item.key)}
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const tNav = useTranslations('nav');
  const tClient = useTranslations('nav.client');
  return (
    <nav
      aria-label={tNav('sidebarAriaLabel')}
      className="border-fg-4/10 bg-bg-1 fixed inset-x-0 bottom-0 z-10 grid grid-cols-5 border-t md:hidden"
    >
      {ITEMS.slice(0, 5).map((item) => {
        const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center justify-center py-3 text-[11px] ${
              active ? 'text-fg-1' : 'text-fg-3'
            }`}
          >
            {tClient(item.key)}
          </Link>
        );
      })}
    </nav>
  );
}
