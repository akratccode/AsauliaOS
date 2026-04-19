import { redirect } from 'next/navigation';
import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';
import { requireAuth } from '@/lib/auth/rbac';
import { db, schema } from '@/lib/db';
import { resolveActiveBrand } from '@/lib/brand/context';
import { getDashboardData } from '@/lib/dashboard/service';
import { Sparkline } from '@/components/charts/Sparkline';
import { formatCents, formatRelative } from '@/lib/format';

export async function generateMetadata() {
  const t = await getTranslations('dashboard.client');
  return { title: t('metadata') };
}

export default async function DashboardPage() {
  const actor = await requireAuth();
  const { active } = await resolveActiveBrand(actor);
  if (!active) redirect('/onboarding/brand');

  const [brand] = await db
    .select({ billingCycleDay: schema.brands.billingCycleDay })
    .from(schema.brands)
    .where(eq(schema.brands.id, active.id))
    .limit(1);

  const stats = await getDashboardData(active.id, brand?.billingCycleDay ?? null);

  const progress =
    stats.deliverablesTotal > 0
      ? Math.round((stats.deliverablesDone / stats.deliverablesTotal) * 100)
      : 0;

  const t = await getTranslations('dashboard.client');
  const tStatus = await getTranslations('statuses.deliverable');

  const statusItems = [
    { key: 'todo', label: tStatus('todo'), statKey: 'todo' },
    { key: 'inProgress', label: tStatus('inProgress'), statKey: 'in_progress' },
    { key: 'inReview', label: tStatus('inReview'), statKey: 'in_review' },
    { key: 'done', label: tStatus('done'), statKey: 'done' },
    { key: 'rejected', label: tStatus('rejected'), statKey: 'rejected' },
  ] as const;

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <header>
        <p className="text-fg-3 text-xs uppercase tracking-[0.12em]">{t('overview')}</p>
        <h1 className="text-fg-1 font-serif text-3xl italic">{t('title')}</h1>
      </header>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Metric
          label={t('daysLeft')}
          value={`${stats.window.daysLeft}`}
          sub={t('daysLeftSub', { total: stats.window.totalDays })}
        />
        <Metric
          label={t('deliverables')}
          value={t('deliverablesSub', {
            done: stats.deliverablesDone,
            total: stats.deliverablesTotal,
          })}
          sub={t('deliverablesComplete', { progress })}
        />
        <Metric
          label={t('attributedSales')}
          value={formatCents(stats.attributedSalesCents)}
          sub={t('attributedSalesSub', { count: stats.attributedSalesCount })}
        />
        <Metric
          label={t('projectedInvoice')}
          value={formatCents(stats.projectedInvoiceCents)}
          sub={stats.plan ? t('projectedInvoiceFixedVariable') : t('projectedInvoicePickPlan')}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="border-fg-4/15 bg-bg-1 rounded-2xl border p-5 md:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-fg-3 text-xs uppercase tracking-[0.12em]">{t('sales')}</div>
              <div className="text-fg-1 font-serif text-lg italic">{t('dailyAttributed')}</div>
            </div>
            <Link href="/sales" className="text-asaulia-blue-soft text-xs hover:underline">
              {t('viewAll')}
            </Link>
          </div>
          <Sparkline data={stats.dailySales} />
        </div>

        <div className="border-fg-4/15 bg-bg-1 rounded-2xl border p-5">
          <div className="text-fg-3 text-xs uppercase tracking-[0.12em]">{t('deliverables')}</div>
          <div className="text-fg-1 mb-2 font-serif text-lg italic">{t('pipeline')}</div>
          <ul className="space-y-1 text-sm">
            {statusItems.map((item) => (
              <li key={item.key} className="flex items-center justify-between">
                <span className="text-fg-2">{item.label}</span>
                <span className="text-fg-1 font-medium">
                  {stats.deliverablesByStatus[item.statKey]}
                </span>
              </li>
            ))}
          </ul>
          <Link
            href="/deliverables"
            className="text-asaulia-blue-soft mt-4 block text-xs hover:underline"
          >
            {t('openBoard')}
          </Link>
        </div>
      </section>

      <section className="border-fg-4/15 bg-bg-1 rounded-2xl border p-5">
        <div className="text-fg-3 text-xs uppercase tracking-[0.12em]">{t('recentActivity')}</div>
        {stats.recentActivity.length === 0 ? (
          <p className="text-fg-3 mt-2 text-sm">
            {t('recentActivityEmpty')}
          </p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {stats.recentActivity.map((item) => (
              <li key={item.id} className="flex items-center justify-between">
                <Link
                  href={item.deliverableId ? `/deliverables?open=${item.deliverableId}` : '/deliverables'}
                  className="text-fg-2 hover:text-fg-1"
                >
                  {item.message}
                </Link>
                <span className="text-fg-3 text-xs">{formatRelative(item.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function Metric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="border-fg-4/15 bg-bg-1 rounded-2xl border p-4">
      <div className="text-fg-3 text-[11px] uppercase tracking-[0.12em]">{label}</div>
      <div className="text-fg-1 mt-1 font-serif text-2xl italic">{value}</div>
      <div className="text-fg-3 mt-0.5 text-xs">{sub}</div>
    </div>
  );
}
