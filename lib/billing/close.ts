import 'server-only';
import { and, eq, lt } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { getStripe, isStripeConfigured } from '@/lib/billing/stripe';
import { attributedSalesForPeriod } from '@/lib/integrations/service';
import { quote } from '@/lib/pricing';
import {
  currentCycleFor,
  periodDateString,
  previousCycleFor,
  activeDaysInCycle,
  fullCycleDays,
  type BillingCycle,
} from '@/lib/billing/period';
import { writeLedger } from '@/lib/billing/ledger';

export type CloseCycleOutcome =
  | { kind: 'closed'; invoiceId: string; totalCents: number }
  | { kind: 'skipped'; reason: string };

type BrandForClose = {
  id: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  billingCycleDay: number | null;
  status: 'trial' | 'active' | 'past_due' | 'paused' | 'cancelled';
  cancelledAt: Date | null;
};

/**
 * Close one brand's billing cycle. Idempotent: replays a second call in the
 * same period return `{ kind: 'skipped' }` without re-inserting invoices or
 * re-creating Stripe invoice items.
 *
 * Inputs are explicit so the cron route can look them up once and the test
 * suite can inject synthetic brands without hitting the DB client's pool.
 */
export async function closeCycleForBrand(params: {
  brand: BrandForClose;
  now: Date;
}): Promise<CloseCycleOutcome> {
  const { brand, now } = params;

  // The period that *just* ended is `previousCycleFor(brand, now)` when now is
  // after the anchor, else the current cycle's start boundary itself.
  const cycle = previousCycleFor(
    { billingCycleDay: brand.billingCycleDay ?? 1 },
    now,
  );

  // Idempotency lock: insert a billing_jobs row up front. Unique on (brand,
  // kind, period_start) — a second invocation during the same period short-
  // circuits.
  const periodStart = periodDateString(cycle.start);
  const periodEnd = periodDateString(cycle.end);
  try {
    await db.insert(schema.billingJobs).values({
      brandId: brand.id,
      kind: 'close_cycle',
      periodStart,
      periodEnd,
    });
  } catch {
    return { kind: 'skipped', reason: 'already_processed' };
  }

  // Load the plan that was effective at `cycle.start` — not the current plan,
  // which may have been overridden.
  const [plan] = await db
    .select()
    .from(schema.plans)
    .where(and(eq(schema.plans.brandId, brand.id), lt(schema.plans.effectiveFrom, cycle.end)))
    .orderBy(schema.plans.effectiveFrom)
    .limit(1);

  if (!plan) {
    await markJobFailed(brand.id, 'close_cycle', periodStart, 'no_active_plan');
    return { kind: 'skipped', reason: 'no_active_plan' };
  }

  const salesWindow = { start: cycle.start, end: cycle.end };
  const sales = await attributedSalesForPeriod(brand.id, salesWindow);

  const effectiveSalesCents = computeVariableSalesCents({
    attributedSalesCents: sales.totalCents,
    cycle,
    cancelledAt: brand.cancelledAt,
  });

  const q = quote({
    fixedAmountCents: plan.fixedAmountCents,
    variablePercentBps: plan.variablePercentBps,
    attributedSalesCents: effectiveSalesCents,
  });

  const [inserted] = await db
    .insert(schema.invoices)
    .values({
      brandId: brand.id,
      periodStart,
      periodEnd,
      fixedAmountCents: q.fixedAmountCents,
      variableAmountCents: q.variableAmountCents,
      currency: q.currency,
      status: 'draft',
      planSnapshot: {
        planId: plan.id,
        fixedAmountCents: plan.fixedAmountCents,
        variablePercentBps: plan.variablePercentBps,
      },
      attributedSalesCents: effectiveSalesCents,
    })
    .returning({ id: schema.invoices.id });

  if (!inserted) {
    await markJobFailed(brand.id, 'close_cycle', periodStart, 'insert_failed');
    return { kind: 'skipped', reason: 'insert_failed' };
  }

  // Stripe side-effect: attach the variable fee to the upcoming subscription
  // invoice so fixed + variable appear as one charge. Fixed comes from the
  // subscription's recurring price; we only add the variable line.
  if (brand.stripeCustomerId && q.variableAmountCents > 0 && isStripeConfigured()) {
    const stripe = getStripe();
    const description = `Variable fee — ${periodStart} to ${periodEnd}`;
    await stripe.invoiceItems.create({
      customer: brand.stripeCustomerId,
      amount: q.variableAmountCents,
      currency: q.currency.toLowerCase(),
      description,
      ...(brand.stripeSubscriptionId ? { subscription: brand.stripeSubscriptionId } : {}),
      metadata: {
        invoiceId: inserted.id,
        brandId: brand.id,
        periodStart,
        periodEnd,
      },
    });
  }

  await writeLedger({
    kind: 'invoice_issued',
    amountCents: q.totalAmountCents,
    brandId: brand.id,
    invoiceId: inserted.id,
    description: `Invoice issued for ${periodStart}..${periodEnd}`,
  });

  await db
    .update(schema.billingJobs)
    .set({ status: 'completed', completedAt: new Date() })
    .where(
      and(
        eq(schema.billingJobs.brandId, brand.id),
        eq(schema.billingJobs.kind, 'close_cycle'),
        eq(schema.billingJobs.periodStart, periodStart),
      ),
    );

  return { kind: 'closed', invoiceId: inserted.id, totalCents: q.totalAmountCents };
}

/**
 * Pro-rate attributed sales when a brand cancelled inside the cycle. Matches
 * the `pro_rata_active_days` policy from `docs/decisions/billing-policy.md`.
 *
 * If the brand is active (or cancelled after the cycle ended), returns the
 * attributed total unchanged. If cancelled inside the cycle, scales by the
 * fraction `activeDays / fullCycleDays` (integer math, floor-rounded).
 */
export function computeVariableSalesCents(params: {
  attributedSalesCents: number;
  cycle: BillingCycle;
  cancelledAt: Date | null;
}): number {
  const { attributedSalesCents, cycle, cancelledAt } = params;
  if (!cancelledAt) return attributedSalesCents;
  const full = fullCycleDays(cycle);
  const active = activeDaysInCycle(cycle, cancelledAt);
  if (active >= full) return attributedSalesCents;
  if (active <= 0) return 0;
  return Math.floor((attributedSalesCents * active) / full);
}

/**
 * Find brands whose cycle ended in the last hour (relative to `now`) and are
 * eligible for close: active/past-due/cancelling brands with a
 * `billing_cycle_day` set.
 *
 * Returns the brands *and* the `previousCycle` end instant used to match, so
 * the caller can assert the boundary.
 */
export async function findBrandsDueForClose(params: {
  now: Date;
  hours?: number;
}): Promise<BrandForClose[]> {
  const hours = params.hours ?? 1;
  const now = params.now;
  const cutoff = new Date(now.getTime() - hours * 3_600_000);

  const candidates = await db
    .select({
      id: schema.brands.id,
      stripeCustomerId: schema.brands.stripeCustomerId,
      stripeSubscriptionId: schema.brands.stripeSubscriptionId,
      billingCycleDay: schema.brands.billingCycleDay,
      status: schema.brands.status,
      cancelledAt: schema.brands.cancelledAt,
    })
    .from(schema.brands);

  return candidates.filter((b) => {
    if (!b.billingCycleDay) return false;
    if (b.status === 'trial' || b.status === 'paused') return false;
    const cycle = currentCycleFor({ billingCycleDay: b.billingCycleDay }, now);
    // Cycle boundary = start of the *current* cycle. If that boundary falls in
    // (cutoff, now], the previous cycle just ended — close it.
    return cycle.start.getTime() > cutoff.getTime() && cycle.start.getTime() <= now.getTime();
  });
}

async function markJobFailed(
  brandId: string,
  kind: 'close_cycle' | 'run_payout' | 'dunning',
  periodStart: string,
  reason: string,
): Promise<void> {
  await db
    .update(schema.billingJobs)
    .set({ status: 'failed', lastError: reason, completedAt: new Date() })
    .where(
      and(
        eq(schema.billingJobs.brandId, brandId),
        eq(schema.billingJobs.kind, kind),
        eq(schema.billingJobs.periodStart, periodStart),
      ),
    );
}
