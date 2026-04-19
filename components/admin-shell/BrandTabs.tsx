'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

type Props = { brandId: string };

type TabDef =
  | { slug: string; ns: 'admin'; key: 'overviewTitle' | 'contractorsTitle' }
  | { slug: string; ns: 'navClient'; key: 'deliverables' | 'plan' | 'sales' }
  | { slug: string; ns: 'navAdmin'; key: 'invoices' | 'audit' }
  | { slug: string; ns: 'recurrences'; key: 'title' };

const TABS: ReadonlyArray<TabDef> = [
  { slug: '', ns: 'admin', key: 'overviewTitle' },
  { slug: 'deliverables', ns: 'navClient', key: 'deliverables' },
  { slug: 'recurrences', ns: 'recurrences', key: 'title' },
  { slug: 'plan', ns: 'navClient', key: 'plan' },
  { slug: 'contractors', ns: 'admin', key: 'contractorsTitle' },
  { slug: 'sales', ns: 'navClient', key: 'sales' },
  { slug: 'invoices', ns: 'navAdmin', key: 'invoices' },
  { slug: 'audit', ns: 'navAdmin', key: 'audit' },
];

export function BrandTabs({ brandId }: Props) {
  const pathname = usePathname();
  const tAdminOverview = useTranslations('admin.overview');
  const tAdminContractors = useTranslations('admin.contractors');
  const tNavClient = useTranslations('nav.client');
  const tNavAdmin = useTranslations('nav.admin');
  const tRecurrences = useTranslations('admin.recurrences');
  const base = `/admin/brands/${brandId}`;

  function labelFor(tab: TabDef): string {
    if (tab.ns === 'admin') {
      if (tab.key === 'overviewTitle') return tAdminOverview('overviewTitle');
      return tAdminContractors('contractorsTitle');
    }
    if (tab.ns === 'navClient') return tNavClient(tab.key);
    if (tab.ns === 'recurrences') return tRecurrences('title');
    return tNavAdmin(tab.key);
  }

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
            {labelFor(t)}
          </Link>
        );
      })}
    </nav>
  );
}
