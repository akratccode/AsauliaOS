'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Props = { brandId: string };

const TABS = [
  { slug: '', label: 'Overview' },
  { slug: 'deliverables', label: 'Deliverables' },
  { slug: 'plan', label: 'Plan' },
  { slug: 'contractors', label: 'Contractors' },
  { slug: 'sales', label: 'Sales' },
  { slug: 'invoices', label: 'Invoices' },
  { slug: 'audit', label: 'Audit' },
] as const;

export function BrandTabs({ brandId }: Props) {
  const pathname = usePathname();
  const base = `/admin/brands/${brandId}`;
  return (
    <nav className="border-fg-4/10 flex flex-wrap gap-1 border-b pb-2 text-xs">
      {TABS.map((t) => {
        const href = t.slug ? `${base}/${t.slug}` : base;
        const active = pathname === href;
        return (
          <Link
            key={t.slug}
            href={href}
            className={`rounded-md px-3 py-1.5 ${
              active ? 'bg-asaulia-blue/20 text-fg-1' : 'text-fg-3 hover:text-fg-1'
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
