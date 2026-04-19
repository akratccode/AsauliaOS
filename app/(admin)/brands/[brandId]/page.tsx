import { eq, isNull, and } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { resolveBillingWindow } from '@/lib/brand/billing-period';
import { attributedSalesForPeriod } from '@/lib/integrations/service';
import { quote, computeSplit } from '@/lib/pricing';
import { formatCents, formatBps } from '@/lib/format';

type Params = Promise<{ brandId: string }>;

export default async function AdminBrandOverviewPage({ params }: { params: Params }) {
  const { brandId } = await params;

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
        <Card label="Owner" value={owner?.email ?? '—'} />
        <Card
          label="Current plan"
          value={
            plan
              ? `${formatCents(plan.fixedAmountCents)} + ${formatBps(plan.variablePercentBps)}`
              : 'No active plan'
          }
        />
        <Card label="Period" value={window.label} hint={`${window.daysLeft}d left`} />
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <Card label="Attributed sales" value={formatCents(sales.totalCents)} hint={`${sales.count} txn`} />
        <Card label="Projected invoice" value={q ? formatCents(q.totalAmountCents) : '—'} />
        <Card
          label="Projected margin"
          value={q ? `${marginPct}%` : '—'}
          hint={split ? `${formatCents(split.asauliaCents)} to Asaulia` : undefined}
        />
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <Card
          label="Contractor pool"
          value={split ? formatCents(split.contractorPoolCents) : '—'}
          hint={split ? `${formatCents(split.contractorFixedPoolCents)} fixed + ${formatCents(split.contractorVariablePoolCents)} variable` : undefined}
        />
        <Card
          label="MRR fixed contribution"
          value={plan ? formatCents(plan.fixedAmountCents) : '—'}
        />
        <Card
          label="Billing cycle anchor"
          value={brand.billingCycleDay ? `Day ${brand.billingCycleDay}` : 'Day 1 (default)'}
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
