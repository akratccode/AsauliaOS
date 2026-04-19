import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getAdminKpis, recentAuditEvents } from '@/lib/admin/kpis';
import { Sparkline } from '@/components/charts/Sparkline';
import { formatCents, formatRelative } from '@/lib/format';

export async function generateMetadata() {
  const t = await getTranslations('admin.overview');
  return { title: t('metadata') };
}

export default async function AdminOverviewPage() {
  const [kpis, events] = await Promise.all([getAdminKpis(), recentAuditEvents(20)]);
  const t = await getTranslations('admin.overview');

  const mrrSeries = kpis.mrr12mo.map((m) => ({
    date: m.monthStart,
    cents: m.fixedCents + m.variableCents,
  }));

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <header>
        <p className="text-fg-3 text-xs uppercase tracking-[0.12em]">{t('operationsLabel')}</p>
        <h1 className="text-fg-1 font-serif text-3xl italic">{t('overviewTitle')}</h1>
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        <Card
          label={t('activeBrands')}
          value={String(kpis.brandsActive)}
          hint={`${kpis.brandsTrial} ${t('trial')}`}
        />
        <Card label={t('mrrFixed')} value={formatCents(kpis.mrrFixedCents)} />
        <Card
          label={t('variable30d')}
          value={formatCents(kpis.variable30dCents)}
          hint={t('attributedSalesFormula')}
        />
        <Card
          label={t('churnedThisMonth')}
          value={String(kpis.brandsChurnedThisMonth)}
          hint={
             
            kpis.brandsChurnedThisMonth > 0 ? 'review payments' : 'all steady'
          }
        />
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <Card
          label={t('contractorsActive')}
          value={String(kpis.contractorsActive)}
          hint={`${kpis.contractorsPending} ${t('onboarding')}`}
        />
        <Card
          label={t('payoutsPending')}
          value={String(kpis.payoutsPending)}
          hint={kpis.payoutsPending > 0 ? t('sendAfterCycleClose') : '—'}
        />
        <Card
          label={t('integrations')}
          value={String(kpis.integrationsActive)}
          hint={
            kpis.integrationsErrored > 0
              ? `${kpis.integrationsErrored} ${t('errored')}`
              : t('allGreen')
          }
          warn={kpis.integrationsErrored > 0}
        />
      </section>

      <section className="border-fg-4/15 bg-bg-1 rounded-2xl border p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-fg-1 font-serif text-lg italic">{t('mrrChart')}</h2>
          <span className="text-fg-3 text-xs">{t('paidAndOpenInvoices')}</span>
        </div>
        {mrrSeries.length === 0 ? (
          <p className="text-fg-3 text-sm">{t('noInvoices')}</p>
        ) : (
          <Sparkline data={mrrSeries} width={800} height={120} />
        )}
        {kpis.mrr12mo.length > 0 && (
          <dl className="text-fg-3 mt-3 grid grid-cols-4 gap-2 text-[11px] md:grid-cols-12">
            {kpis.mrr12mo.map((m) => (
              <div key={m.monthStart}>
                <dt className="uppercase tracking-[0.1em]">{m.monthStart.slice(0, 7)}</dt>
                <dd className="text-fg-2">{formatCents(m.fixedCents + m.variableCents)}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <section className="border-fg-4/15 bg-bg-1 rounded-2xl border p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-fg-1 font-serif text-lg italic">{t('recentActivity')}</h2>
          <Link href="/admin/audit" className="text-fg-3 hover:text-fg-1 text-xs">
            {t('seeAll')}
          </Link>
        </div>
        {events.length === 0 ? (
          <p className="text-fg-3 text-sm">{t('nothingHappened')}</p>
        ) : (
          <ul className="divide-fg-4/10 divide-y">
            {events.map((e) => (
              <li key={e.id} className="flex items-center justify-between py-2 text-xs">
                <div>
                  <span className="text-fg-1 font-medium">{e.action}</span>
                  <span className="text-fg-3 ml-2">
                    {e.entityType ?? ''}{' '}
                    {e.entityId ? <span className="font-mono">{e.entityId.slice(0, 8)}</span> : null}
                  </span>
                </div>
                <span className="text-fg-3">{formatRelative(e.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function Card({
  label,
  value,
  hint,
  warn,
}: {
  label: string;
  value: string;
  hint?: string;
  warn?: boolean;
}) {
  return (
    <div
      className={`bg-bg-1 rounded-2xl border p-5 ${
        warn ? 'border-asaulia-red/40' : 'border-fg-4/15'
      }`}
    >
      <p className="text-fg-3 text-xs uppercase tracking-[0.12em]">{label}</p>
      <p className="text-fg-1 mt-1 font-serif text-3xl italic">{value}</p>
      {hint && <p className="text-fg-3 mt-1 text-xs">{hint}</p>}
    </div>
  );
}
