'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/deliverables', label: 'Deliverables' },
  { href: '/sales', label: 'Sales' },
  { href: '/plan', label: 'Plan' },
  { href: '/billing', label: 'Billing' },
  { href: '/team', label: 'Team' },
  { href: '/settings', label: 'Settings' },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="border-fg-4/10 bg-bg-1 hidden w-60 shrink-0 flex-col gap-1 border-r p-4 md:flex"
    >
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
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
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
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
