'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/brands', label: 'Brands' },
  { href: '/admin/contractors', label: 'Contractors' },
  { href: '/admin/contractors/matrix', label: 'Matrix' },
  { href: '/admin/finances', label: 'Finances' },
  { href: '/admin/finances/payouts', label: 'Payouts' },
  { href: '/admin/finances/invoices', label: 'Invoices' },
  { href: '/admin/audit', label: 'Audit' },
  { href: '/admin/config', label: 'Config' },
] as const;

export function AdminSidebar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Admin"
      className="border-fg-4/10 bg-bg-1 hidden w-56 shrink-0 flex-col gap-1 border-r p-4 md:flex"
    >
      <div className="text-asaulia-blue-soft mb-3 px-2 font-serif text-lg italic">Asaulia</div>
      <div className="text-fg-3 mb-2 px-2 text-[10px] uppercase tracking-[0.12em]">Admin</div>
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
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
