import 'server-only';
import { and, eq, gte, isNull, lte, lt, or } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { getStripe, isStripeConfigured } from '@/lib/billing/stripe';
import { computeSplit, distributeContractorPool } from '@/lib/pricing';
import { BILLING_POLICY } from '@/lib/billing/policy';
import { writeLedger } from '@/lib/billing/ledger';

export type PayoutOutcome =
  | { kind: 'paid'; payoutId: string; amountCents: number }
  | { kind: 'carried'; contractorUserId: string; amountCents: number }
  | { kind: 'pending_setup'; contractorUserId: string; amountCents: number }
  | { kind: 'skipped'; reason: string };

type InvoiceForPayout = {
  id: string;
  brandId: string;
  periodStart: string;
  periodEnd: string;
  fixedAmountCents: number;
  variableAmountCents: number;
  currency: string;
  financeRegion: 'us' | 'co';
};

/**
 * Compute and transfer payouts for a single paid invoice.
 *
 * Order of operations per contractor:
 *  1. Add any carryover from prior periods (store on `contractor_profiles`).
 *  2. If total < MIN_PAYOUT_CENTS → carryover, no transfer, ledger entry.
 *  3. If Stripe Connect account missing/not-ready → mark `pending_setup`.
 *  4. Else create `stripe.transfers.create` + insert/update payouts row +
 *     zero out carryover + ledger entry.
 *
 * Idempotency: a `billing_jobs` row with kind='run_payout' per (brand,
 * period_start) guards against duplicate runs. The payouts table's unique
 * index on `(contractor_user_id, period_start)` provides a second defense —
 * if we crash after transfers but before updating, a replay will attempt the
 * same transfer and Stripe's idempotency key (we use the invoice+contractor
 * pair) prevents a duplicate charge.
 */
export async function runPayoutsForInvoice(params: {
  invoice: InvoiceForPayout;
  now: Date;
}): Promise<{ perContractor: PayoutOutcome[] }> {
  const { invoice, now } = params;

  try {
    await db.insert(schema.billingJobs).values({
      brandId: invoice.brandId,
      kind: 'run_payout',
      periodStart: invoice.periodStart,
      periodEnd: invoice.periodEnd,
    });
  } catch {
    return { perContractor: [{ kind: 'skipped', reason: 'already_processed' }] };
  }

  // Load assigned, still-active contractors for the period.
  const assignments = await db
    .select({
      contractorUserId: schema.brandContractors.contractorUserId,
      startedAt: schema.brandContractors.startedAt,
      endedAt: schema.brandContractors.endedAt,
    })
    .from(schema.brandContractors)
    .where(
      and(
        eq(schema.brandContractors.brandId, invoice.brandId),
        lte(schema.brandContractors.startedAt, new Date(invoice.periodEnd)),
        or(
          isNull(schema.brandContractors.endedAt),
          gte(schema.brandContractors.endedAt, new Date(invoice.periodStart)),
        ),
      ),
    );

  const uniqueContractorIds = Array.from(
    new Set(assignments.map((a) => a.contractorUserId)),
  );

  if (uniqueContractorIds.length === 0) {
    await completePayoutJob(invoice.brandId, invoice.periodStart);
    return { perContractor: [{ kind: 'skipped', reason: 'no_contractors' }] };
  }

  // Load weight overrides for this exact period (else equal-split via 0 bps).
  const weights = await db
    .select({
      contractorUserId: schema.brandContractorWeights.contractorUserId,
      variableShareBps: schema.brandContractorWeights.variableShareBps,
    })
    .from(schema.brandContractorWeights)
    .where(
      and(
        eq(schema.brandContractorWeights.brandId, invoice.brandId),
        eq(schema.brandContractorWeights.periodStart, invoice.periodStart),
      ),
    );
  const weightByContractor = new Map<string, number>();
  for (const w of weights) weightByContractor.set(w.contractorUserId, w.variableShareBps);

  // Load done deliverables for the period to drive fixed-pool weighting.
  const deliverables = await db
    .select({
      id: schema.deliverables.id,
      assigneeUserId: schema.deliverables.assigneeUserId,
      fixedShareBps: schema.deliverables.fixedShareBps,
      status: schema.deliverables.status,
    })
    .from(schema.deliverables)
    .where(
      and(
        eq(schema.deliverables.brandId, invoice.brandId),
        eq(schema.deliverables.status, 'done'),
        isNull(schema.deliverables.archivedAt),
        gte(schema.deliverables.completedAt, new Date(invoice.periodStart)),
        lt(schema.deliverables.completedAt, new Date(invoice.periodEnd)),
      ),
    );

  const split = computeSplit({
    fixedAmountCents: invoice.fixedAmountCents,
    variableAmountCents: invoice.variableAmountCents,
  });

  const dist = distributeContractorPool({
    contractorFixedPoolCents: split.contractorFixedPoolCents,
    contractorVariablePoolCents: split.contractorVariablePoolCents,
    deliverables: deliverables
      .filter((d): d is typeof d & { assigneeUserId: string } => Boolean(d.assigneeUserId))
      .map((d) => ({
        id: d.id,
        assigneeUserId: d.assigneeUserId,
        fixedShareBps: d.fixedShareBps,
        status: d.status,
      })),
    contractors: uniqueContractorIds.map((userId) => ({
      userId,
      variableShareBps: weightByContractor.get(userId) ?? 0,
    })),
  });

  const outcomes: PayoutOutcome[] = [];
  for (const share of dist.shares) {
    const outcome = await settleContractorShare({
      contractorUserId: share.userId,
      earnedCents: share.totalCents,
      invoice,
      breakdown: {
        fixedShareCents: share.fixedShareCents,
        variableShareCents: share.variableShareCents,
        contributingDeliverables: share.contributingDeliverables,
      },
      now,
    });
    outcomes.push(outcome);
  }

  await completePayoutJob(invoice.brandId, invoice.periodStart);
  return { perContractor: outcomes };
}

async function settleContractorShare(params: {
  contractorUserId: string;
  earnedCents: number;
  invoice: InvoiceForPayout;
  breakdown: unknown;
  now: Date;
}): Promise<PayoutOutcome> {
  const { contractorUserId, earnedCents, invoice, breakdown, now } = params;

  const [profile] = await db
    .select({
      stripeConnectAccountId: schema.contractorProfiles.stripeConnectAccountId,
      payoutOnboardingComplete: schema.contractorProfiles.payoutOnboardingComplete,
      carryover: schema.contractorProfiles.payoutCarryoverCents,
    })
    .from(schema.contractorProfiles)
    .where(eq(schema.contractorProfiles.userId, contractorUserId))
    .limit(1);

  const carryover = profile?.carryover ?? 0;
  const total = earnedCents + carryover;

  if (total <= 0) {
    return { kind: 'skipped', reason: 'zero_amount' };
  }

  if (total < BILLING_POLICY.MIN_PAYOUT_CENTS) {
    await db
      .update(schema.contractorProfiles)
      .set({ payoutCarryoverCents: total, updatedAt: now })
      .where(eq(schema.contractorProfiles.userId, contractorUserId));
    await writeLedger({
      kind: 'carryover',
      amountCents: total,
      contractorUserId,
      brandId: invoice.brandId,
      invoiceId: invoice.id,
      description: `Below $50 minimum — carried to next cycle (${total} cents)`,
    });
    return { kind: 'carried', contractorUserId, amountCents: total };
  }

  // Colombia (manual) flow: don't require Stripe Connect. Leave the payout in
  // `pending` so the admin can mark it paid from the finances dashboard after
  // wiring the money manually.
  if (invoice.financeRegion === 'co') {
    const [pendingManual] = await db
      .insert(schema.payouts)
      .values({
        contractorUserId,
        periodStart: invoice.periodStart,
        periodEnd: invoice.periodEnd,
        amountCents: total,
        currency: invoice.currency,
        financeRegion: invoice.financeRegion,
        status: 'pending',
        breakdown,
      })
      .onConflictDoUpdate({
        target: [schema.payouts.contractorUserId, schema.payouts.periodStart],
        set: {
          amountCents: total,
          currency: invoice.currency,
          financeRegion: invoice.financeRegion,
          status: 'pending',
          updatedAt: now,
        },
      })
      .returning({ id: schema.payouts.id });
    await db
      .update(schema.contractorProfiles)
      .set({ payoutCarryoverCents: 0, updatedAt: now })
      .where(eq(schema.contractorProfiles.userId, contractorUserId));
    return pendingManual
      ? { kind: 'pending_setup', contractorUserId, amountCents: total }
      : { kind: 'skipped', reason: 'payout_insert_failed' };
  }

  if (!profile?.stripeConnectAccountId || !profile.payoutOnboardingComplete) {
    // Preserve the carryover (so they don't lose the accumulated amount) and
    // surface a pending-setup record by inserting a failed payout row.
    await db.insert(schema.payouts).values({
      contractorUserId,
      periodStart: invoice.periodStart,
      periodEnd: invoice.periodEnd,
      amountCents: total,
      currency: invoice.currency,
      financeRegion: invoice.financeRegion,
      status: 'failed',
      failureReason: 'stripe_connect_incomplete',
      breakdown,
    }).onConflictDoNothing();
    await db
      .update(schema.contractorProfiles)
      .set({ payoutCarryoverCents: total, updatedAt: now })
      .where(eq(schema.contractorProfiles.userId, contractorUserId));
    return { kind: 'pending_setup', contractorUserId, amountCents: total };
  }

  // Insert pending payout row first so a crash mid-transfer still surfaces it
  // in the queue (Phase 10 payouts view).
  const [pending] = await db
    .insert(schema.payouts)
    .values({
      contractorUserId,
      periodStart: invoice.periodStart,
      periodEnd: invoice.periodEnd,
      amountCents: total,
      currency: invoice.currency,
      financeRegion: invoice.financeRegion,
      status: 'processing',
      breakdown,
    })
    .onConflictDoUpdate({
      target: [schema.payouts.contractorUserId, schema.payouts.periodStart],
      set: {
        amountCents: total,
        currency: invoice.currency,
        financeRegion: invoice.financeRegion,
        status: 'processing',
        updatedAt: now,
      },
    })
    .returning({ id: schema.payouts.id });

  if (!pending) {
    return { kind: 'skipped', reason: 'payout_insert_failed' };
  }

  const idempotencyKey = `payout:${invoice.id}:${contractorUserId}`;

  if (isStripeConfigured()) {
    try {
      const stripe = getStripe();
      const transfer = await stripe.transfers.create(
        {
          amount: total,
          currency: invoice.currency.toLowerCase(),
          destination: profile.stripeConnectAccountId,
          description: `Asaulia payout — ${invoice.periodStart}..${invoice.periodEnd}`,
          metadata: {
            payoutId: pending.id,
            invoiceId: invoice.id,
            brandId: invoice.brandId,
            contractorUserId,
            periodStart: invoice.periodStart,
            periodEnd: invoice.periodEnd,
          },
        },
        { idempotencyKey },
      );
      await db
        .update(schema.payouts)
        .set({
          status: 'paid',
          stripeTransferId: transfer.id,
          paidAt: now,
          updatedAt: now,
        })
        .where(eq(schema.payouts.id, pending.id));
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      await db
        .update(schema.payouts)
        .set({ status: 'failed', failureReason: reason, updatedAt: now })
        .where(eq(schema.payouts.id, pending.id));
      await writeLedger({
        kind: 'payout_failed',
        amountCents: total,
        currency: invoice.currency,
        financeRegion: invoice.financeRegion,
        contractorUserId,
        brandId: invoice.brandId,
        invoiceId: invoice.id,
        payoutId: pending.id,
        description: reason.slice(0, 200),
      });
      return { kind: 'skipped', reason: 'stripe_transfer_failed' };
    }
  } else {
    // Test/dev mode: flip to paid without a real transfer so downstream
    // tests can assert on the ledger + row state deterministically.
    await db
      .update(schema.payouts)
      .set({ status: 'paid', paidAt: now, updatedAt: now })
      .where(eq(schema.payouts.id, pending.id));
  }

  await db
    .update(schema.contractorProfiles)
    .set({ payoutCarryoverCents: 0, updatedAt: now })
    .where(eq(schema.contractorProfiles.userId, contractorUserId));

  await writeLedger({
    kind: 'payout_sent',
    amountCents: -total,
    currency: invoice.currency,
    financeRegion: invoice.financeRegion,
    contractorUserId,
    brandId: invoice.brandId,
    invoiceId: invoice.id,
    payoutId: pending.id,
    description: `Payout to contractor for ${invoice.periodStart}..${invoice.periodEnd}`,
  });

  return { kind: 'paid', payoutId: pending.id, amountCents: total };
}

async function completePayoutJob(brandId: string, periodStart: string): Promise<void> {
  await db
    .update(schema.billingJobs)
    .set({ status: 'completed', completedAt: new Date() })
    .where(
      and(
        eq(schema.billingJobs.brandId, brandId),
        eq(schema.billingJobs.kind, 'run_payout'),
        eq(schema.billingJobs.periodStart, periodStart),
      ),
    );
}

/**
 * Find paid invoices past the reconciliation buffer that don't yet have a
 * `run_payout` job. Used by the daily payout cron.
 */
export async function findInvoicesDueForPayout(params: {
  now: Date;
}): Promise<InvoiceForPayout[]> {
  const cutoff = new Date(params.now.getTime() - BILLING_POLICY.PAYOUT_DELAY_DAYS * 86_400_000);
  const cutoffYmd = `${cutoff.getUTCFullYear()}-${String(cutoff.getUTCMonth() + 1).padStart(2, '0')}-${String(cutoff.getUTCDate()).padStart(2, '0')}`;

  const rows = await db
    .select({
      id: schema.invoices.id,
      brandId: schema.invoices.brandId,
      periodStart: schema.invoices.periodStart,
      periodEnd: schema.invoices.periodEnd,
      fixedAmountCents: schema.invoices.fixedAmountCents,
      variableAmountCents: schema.invoices.variableAmountCents,
      currency: schema.invoices.currency,
      financeRegion: schema.invoices.financeRegion,
    })
    .from(schema.invoices)
    .leftJoin(
      schema.billingJobs,
      and(
        eq(schema.billingJobs.brandId, schema.invoices.brandId),
        eq(schema.billingJobs.kind, 'run_payout'),
        eq(schema.billingJobs.periodStart, schema.invoices.periodStart),
      ),
    )
    .where(
      and(
        eq(schema.invoices.status, 'paid'),
        lte(schema.invoices.periodEnd, cutoffYmd),
        isNull(schema.billingJobs.id),
      ),
    )
    .limit(200);

  return rows;
}
