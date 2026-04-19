import { redirect } from 'next/navigation';
import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/rbac';
import { db, schema } from '@/lib/db';
import { resolveActiveBrand, requireClientBrandAccess } from '@/lib/brand/context';
import {
  currentAndUpcomingPlan,
  planChangeAvailableOn,
} from '@/lib/plans/change';
import { attributedSalesForPeriod } from '@/lib/integrations/service';
import { resolveBillingWindow } from '@/lib/brand/billing-period';
import { formatBps, formatCents, formatDate } from '@/lib/format';
import { PlanChangeForm } from './PlanChangeForm';

export default async function PlanPage() {
  const actor = await requireAuth();
  const { active } = await resolveActiveBrand(actor);
  if (!active) redirect('/onboarding/brand');
  await requireClientBrandAccess(actor, active.id);

  const [brand] = await db
    .select({ billingCycleDay: schema.brands.billingCycleDay })
    .from(schema.brands)
    .where(eq(schema.brands.id, active.id))
    .limit(1);

  const window = resolveBillingWindow(brand?.billingCycleDay ?? null);
  const { current, upcoming } = await currentAndUpcomingPlan(active.id);
  const sales = await attributedSalesForPeriod(active.id, {
    start: window.start,
    end: window.end,
  });

  const latestCreatedAt = current?.createdAt ?? null;
  const availableOn = planChangeAvailableOn(latestCreatedAt);
  const now = new Date();
  const locked = availableOn ? availableOn > now : false;

  const fixed = current?.fixedAmountCents ?? 0;
  const variable = current?.variablePercentBps ?? 0;

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 p-6">
      <header>
        <p className="text-fg-3 text-xs uppercase tracking-[0.12em]">Pricing</p>
        <h1 className="text-fg-1 font-serif text-3xl italic">Your plan</h1>
      </header>

      <section className="border-fg-4/15 bg-bg-1 rounded-2xl border p-5">
        {current ? (
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-fg-3 text-xs uppercase tracking-[0.12em]">
                Current plan
              </div>
              <div className="text-fg-1 font-serif text-4xl italic">
                {formatCents(fixed)}
                <span className="text-fg-3 ml-2 text-sm">/ month</span>
              </div>
              <div className="text-fg-2 mt-1 text-sm">
                + {formatBps(variable)} of attributed sales
              </div>
            </div>
            <div className="text-fg-3 text-xs">
              <div>Next close: {formatDate(window.end)}</div>
              <div>
                Period sales so far: {formatCents(sales.totalCents)} · {sales.count} orders
              </div>
            </div>
          </div>
        ) : (
          <p className="text-fg-3 text-sm">No active plan. Finish onboarding first.</p>
        )}
      </section>

      {upcoming && (
        <section className="border-asaulia-blue/30 bg-asaulia-blue/5 rounded-2xl border p-5 text-sm">
          <div className="text-fg-3 text-xs uppercase tracking-[0.12em]">Scheduled</div>
          <div className="text-fg-1 mt-1">
            Moves to {formatCents(upcoming.fixedAmountCents)} +{' '}
            {formatBps(upcoming.variablePercentBps)} on{' '}
            {formatDate(upcoming.effectiveFrom)}.
          </div>
        </section>
      )}

      <section>
        <h2 className="text-fg-2 mb-3 text-sm uppercase tracking-[0.12em]">Adjust plan</h2>
        <PlanChangeForm
          currentFixedCents={fixed || 19_900}
          currentVariableBps={variable}
          projectedMonthlySalesCents={sales.totalCents || 300_000}
          locked={locked}
          cooldownUntil={availableOn?.toISOString() ?? null}
          effectiveFromLabel={formatDate(window.end)}
        />
      </section>

      <Link href="/plan/history" className="text-asaulia-blue-soft text-xs hover:underline">
        See plan history →
      </Link>
    </main>
  );
}
