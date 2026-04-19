import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireAuth } from '@/lib/auth/rbac';
import { resolveActiveBrand, requireClientBrandAccess } from '@/lib/brand/context';
import { listPlanHistory } from '@/lib/plans/change';
import { formatBps, formatCents, formatDate } from '@/lib/format';

export async function generateMetadata() {
  const t = await getTranslations('client.plan');
  return { title: t('metadata') };
}

export default async function PlanHistoryPage() {
  const actor = await requireAuth();
  const { active } = await resolveActiveBrand(actor);
  if (!active) redirect('/onboarding/brand');
  await requireClientBrandAccess(actor, active.id);

  const rows = await listPlanHistory(active.id);

  const t = await getTranslations('client.plan');

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 p-6">
      <Link href="/plan" className="text-fg-3 text-xs hover:underline">
        { }
        ← {t('planTitle')}
      </Link>
      <header>
        <p className="text-fg-3 text-xs uppercase tracking-[0.12em]">{t('auditLabel')}</p>
        <h1 className="text-fg-1 font-serif text-3xl italic">{t('planHistoryTitle')}</h1>
      </header>

      <section className="border-fg-4/15 bg-bg-1 rounded-2xl border p-5">
        {rows.length === 0 ? (
          <p className="text-fg-3 text-sm">{t('noPlanHistory')}</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-fg-3 text-xs uppercase tracking-[0.12em]">
              <tr>
                <th className="py-2">{t('effectiveFrom')}</th>
                <th className="py-2">{t('effectiveTo')}</th>
                <th className="py-2 text-right">{t('fixed')}</th>
                <th className="py-2 text-right">{t('variable')}</th>
                <th className="py-2">{t('reason')}</th>
              </tr>
            </thead>
            <tbody className="divide-fg-4/10 divide-y">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="py-2 text-fg-2">{formatDate(row.effectiveFrom)}</td>
                  <td className="py-2 text-fg-2">
                    {row.effectiveTo ? formatDate(row.effectiveTo) : t('current')}
                  </td>
                  <td className="py-2 text-right text-fg-1">
                    {formatCents(row.fixedAmountCents)}
                  </td>
                  <td className="py-2 text-right text-fg-1">
                    {formatBps(row.variablePercentBps)}
                  </td>
                  <td className="py-2 text-fg-3 text-xs">{row.reason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
