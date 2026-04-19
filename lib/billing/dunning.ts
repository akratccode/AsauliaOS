import 'server-only';
import { and, eq, isNotNull, ne } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { getStripe, isStripeConfigured } from '@/lib/billing/stripe';
import { BILLING_POLICY } from '@/lib/billing/policy';
import { writeLedger } from '@/lib/billing/ledger';

export type DunningOutcome =
  | { kind: 'ok'; brandId: string; daysPastDue: number; actions: DunningAction[] }
  | { kind: 'skipped'; brandId: string; reason: string };

export type DunningAction =
  | 'freeze_deliverables'
  | 'cancel_subscription'
  | 'noop';

type BrandForDunning = {
  id: string;
  status: 'trial' | 'active' | 'past_due' | 'paused' | 'cancelled';
  deliverablesFrozen: boolean;
  pastDueSince: Date | null;
  stripeSubscriptionId: string | null;
};

/**
 * Apply the dunning state machine to one brand. Idempotent: re-running on the
 * same day is safe because each action is guarded by the current brand state
 * (`deliverablesFrozen`, `status`).
 *
 * Day 0..6  → noop (Stripe smart retries continue in the background)
 * Day 7     → freeze deliverables (clients keep access; staff cannot deliver)
 * Day 14    → cancel subscription (brand → cancelled, stop service)
 */
export async function runDunningForBrand(params: {
  brand: BrandForDunning;
  now: Date;
}): Promise<DunningOutcome> {
  const { brand, now } = params;
  if (!brand.pastDueSince) {
    return { kind: 'skipped', brandId: brand.id, reason: 'not_past_due' };
  }
  if (brand.status === 'cancelled' || brand.status === 'paused') {
    return { kind: 'skipped', brandId: brand.id, reason: `status_${brand.status}` };
  }

  const daysPastDue = Math.floor(
    (now.getTime() - brand.pastDueSince.getTime()) / 86_400_000,
  );
  const actions: DunningAction[] = [];

  if (daysPastDue >= BILLING_POLICY.CANCEL_ON_DAY) {
    if (brand.stripeSubscriptionId && isStripeConfigured()) {
      try {
        await getStripe().subscriptions.cancel(brand.stripeSubscriptionId);
      } catch {
        // Stripe-side state may already be cancelled; we still flip our row.
      }
    }
    await db
      .update(schema.brands)
      .set({
        status: 'cancelled',
        cancelledAt: now,
        deliverablesFrozen: true,
        updatedAt: now,
      })
      .where(eq(schema.brands.id, brand.id));
    await writeLedger({
      kind: 'adjustment',
      amountCents: 0,
      brandId: brand.id,
      description: `Dunning: subscription cancelled after ${daysPastDue} days past due`,
    });
    actions.push('cancel_subscription');
  } else if (daysPastDue >= BILLING_POLICY.FREEZE_ON_DAY) {
    if (!brand.deliverablesFrozen) {
      await db
        .update(schema.brands)
        .set({ deliverablesFrozen: true, updatedAt: now })
        .where(eq(schema.brands.id, brand.id));
      await writeLedger({
        kind: 'adjustment',
        amountCents: 0,
        brandId: brand.id,
        description: `Dunning: deliverables frozen after ${daysPastDue} days past due`,
      });
      actions.push('freeze_deliverables');
    } else {
      actions.push('noop');
    }
  } else {
    actions.push('noop');
  }

  return { kind: 'ok', brandId: brand.id, daysPastDue, actions };
}

/**
 * Candidate brands for the daily dunning sweep: any brand with
 * `past_due_since IS NOT NULL` and not already terminal-cancelled.
 */
export async function findBrandsForDunning(): Promise<BrandForDunning[]> {
  return db
    .select({
      id: schema.brands.id,
      status: schema.brands.status,
      deliverablesFrozen: schema.brands.deliverablesFrozen,
      pastDueSince: schema.brands.pastDueSince,
      stripeSubscriptionId: schema.brands.stripeSubscriptionId,
    })
    .from(schema.brands)
    .where(
      and(
        isNotNull(schema.brands.pastDueSince),
        ne(schema.brands.status, 'cancelled'),
      ),
    );
}
