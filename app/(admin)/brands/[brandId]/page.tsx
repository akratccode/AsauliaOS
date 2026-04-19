import { eq, isNull, and } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';
import { db, schema } from '@/lib/db';
import { resolveBillingWindow } from '@/lib/brand/billing-period';
import { attributedSalesForPeriod } from '@/lib/integrations/service';
import { quote, computeSplit } from '@/lib/pricing';
import { formatCents, formatBps } from '@/lib/format';

type Params = Promise<{ brandId: string }>;

export default async function AdminBrandOverviewPage({ params }: { params: Params }) {
  const { brandId } = await params;
  const t = await getTranslations('admin.brandOverview');

  const [brand] = await db
    .select({
      billingCycleDay: schema.brands.billingCycleDay,
      createdAt: schema.brands.createdAt,
      ownerUserId: schema.brands.ownerUserId,
    })
    .from(schema.brands)
    .where(eq(schema.brands.id, brandId))
    .limit(1);
  if (!brand) return null;

  const [plan] = await db
    .select()
    .from(schema.plans)
    .where(and(eq(schema.plans.brandId, brandId), isNull(schema.plans.effectiveTo)))
    .limit(1);

  const window = resolveBillingWindow(brand.billingCycleDay ?? null);
  const sales = await attributedSalesForPeriod(brandId, {
    start: window.start,
    end: window.end,
  });

  const q = plan
    ? quote({
        fixedAmountCents: plan.fixedAmountCents,
        variablePercentBps: plan.variablePercentBps,
        attributedSalesCents: sales.totalCents,
      })
    : null;
  const split = q
    ? computeSplit({
        fixedAmountCents: q.fixedAmountCents,
        variableAmountCents: q.variableAmountCents,
      })
    : null;

  const marginPct = q && split
    ? Math.round((split.asauliaCents / q.totalAmountCents) * 100)
    : 0;

  const [owner] = await db
    .select({ email: schema.users.email })
    .from(schema.users)
    .where(eq(schema.users.id, brand.ownerUserId))
    .limit(1);

  return (
    <div className="space-y-5">
      <section className="grid gap-3 md:grid-cols-3">
        <Card label={t('owner')} value={owner?.email ?? '—'} />
        <Card
          label={t('currentPlan')}
          value={
            plan
              ? `${formatCents(plan.fixedAmountCents)} + ${formatBps(plan.variablePercentBps)}`
              : t('noActivePlan')
          }
        />
        <Card
          label={t('period')}
          value={window.label}
          hint={`${window.daysLeft}${t('daysLeft')}`}
        />
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <Card
          label={t('attributedSales')}
          value={formatCents(sales.totalCents)}
          hint={`${sales.count} ${t('txn')}`}
        />
        <Card label={t('projectedInvoice')} value={q ? formatCents(q.totalAmountCents) : '—'} />
        <Card
          label={t('projectedMargin')}
          value={q ? `${marginPct}%` : '—'}
          hint={split ? `${formatCents(split.asauliaCents)} ${t('toAsaulia')}` : undefined}
        />
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <Card
          label={t('contractorPool')}
          value={split ? formatCents(split.contractorPoolCents) : '—'}
          hint={
            split
              ? `${formatCents(split.contractorFixedPoolCents)} ${t('fixed')} + ${formatCents(
                  split.contractorVariablePoolCents,
                )} ${t('variable')}`
              : undefined
          }
        />
        <Card
          label={t('mrrFixedContribution')}
          value={plan ? formatCents(plan.fixedAmountCents) : '—'}
        />
        <Card
          label={t('billingCycleAnchor')}
          value={
            brand.billingCycleDay
              ? `${t('day')} ${brand.billingCycleDay}`
              : `${t('day')} 1 (${t('default')})`
          }
        />
      </section>
    </div>
  );
}

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="border-fg-4/15 bg-bg-1 rounded-2xl border p-5">
      <p className="text-fg-3 text-xs uppercase tracking-[0.12em]">{label}</p>
      <p className="text-fg-1 mt-1 font-serif text-xl italic">{value}</p>
      {hint && <p className="text-fg-3 mt-1 text-xs">{hint}</p>}
    </div>
  );
}
