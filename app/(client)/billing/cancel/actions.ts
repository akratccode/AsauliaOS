'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/rbac';
import { db, schema } from '@/lib/db';
import { resolveActiveBrand, requireClientBrandAccess } from '@/lib/brand/context';
import { getStripe, isStripeConfigured } from '@/lib/billing/stripe';

export type BillingErrorCode =
  | 'no_active_brand'
  | 'brand_not_found'
  | 'only_owner_can_cancel'
  | 'only_owner_can_reverse'
  | 'subscription_already_cancelled'
  | 'subscription_already_terminated'
  | 'no_pending_cancellation'
  | 'stripe_cancel_failed'
  | 'stripe_reversal_failed';

export type BillingInfoCode = 'cancellation_scheduled';

export type CancelActionState =
  | { ok: false; error: BillingErrorCode; detail?: string }
  | { ok: true; info?: BillingInfoCode; cancelledAt: string }
  | undefined;

/**
 * Cancel-at-period-end flow for brand owners. The subscription stays active
 * until the current cycle closes; the close-cycles cron will apply pro-rata
 * variable fees per `BILLING_POLICY.CANCEL_VARIABLE_MODE`. Reversible until
 * the period rolls over.
 */
export async function cancelSubscriptionAction(
  _prev: CancelActionState,
  _formData: FormData,
): Promise<CancelActionState> {
  const actor = await requireAuth();
  const { active } = await resolveActiveBrand(actor);
  if (!active) return { ok: false, error: 'no_active_brand' };
  const { role } = await requireClientBrandAccess(actor, active.id);
  if (role !== 'owner' && actor.globalRole !== 'admin' && actor.globalRole !== 'operator') {
    return { ok: false, error: 'only_owner_can_cancel' };
  }

  const [brand] = await db
    .select({
      id: schema.brands.id,
      status: schema.brands.status,
      stripeSubscriptionId: schema.brands.stripeSubscriptionId,
      cancelledAt: schema.brands.cancelledAt,
    })
    .from(schema.brands)
    .where(eq(schema.brands.id, active.id))
    .limit(1);
  if (!brand) return { ok: false, error: 'brand_not_found' };
  if (brand.status === 'cancelled') {
    return { ok: false, error: 'subscription_already_cancelled' };
  }

  const now = new Date();

  if (brand.stripeSubscriptionId && isStripeConfigured()) {
    try {
      const sub = await getStripe().subscriptions.update(brand.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
      const cancelAt = sub.cancel_at ? new Date(sub.cancel_at * 1000) : now;
      await db
        .update(schema.brands)
        .set({ cancelledAt: cancelAt, updatedAt: now })
        .where(eq(schema.brands.id, brand.id));
    } catch (err) {
      return {
        ok: false,
        error: 'stripe_cancel_failed',
        detail: err instanceof Error ? err.message : undefined,
      };
    }
  } else {
    // No Stripe subscription yet (e.g. trial brand that never completed checkout).
    await db
      .update(schema.brands)
      .set({ status: 'cancelled', cancelledAt: now, updatedAt: now })
      .where(eq(schema.brands.id, brand.id));
  }

  await db.insert(schema.auditLog).values({
    actorUserId: actor.userId,
    brandId: brand.id,
    action: 'subscription_cancelled',
    entityType: 'brand',
    entityId: brand.id,
    before: { status: brand.status, cancelledAt: brand.cancelledAt },
    after: { status: brand.status === 'trial' ? 'cancelled' : brand.status, cancelAtPeriodEnd: true },
  });

  revalidatePath('/billing');
  revalidatePath('/plan');
  return { ok: true, info: 'cancellation_scheduled', cancelledAt: now.toISOString() };
}

/**
 * Reverse a pending cancellation while still within the current cycle. Stripe
 * re-activates the subscription; we clear `brands.cancelledAt`.
 */
export async function undoCancelSubscriptionAction(
  _prev: CancelActionState,
  _formData: FormData,
): Promise<CancelActionState> {
  const actor = await requireAuth();
  const { active } = await resolveActiveBrand(actor);
  if (!active) return { ok: false, error: 'no_active_brand' };
  const { role } = await requireClientBrandAccess(actor, active.id);
  if (role !== 'owner' && actor.globalRole !== 'admin' && actor.globalRole !== 'operator') {
    return { ok: false, error: 'only_owner_can_reverse' };
  }

  const [brand] = await db
    .select({
      id: schema.brands.id,
      status: schema.brands.status,
      stripeSubscriptionId: schema.brands.stripeSubscriptionId,
      cancelledAt: schema.brands.cancelledAt,
    })
    .from(schema.brands)
    .where(eq(schema.brands.id, active.id))
    .limit(1);
  if (!brand) return { ok: false, error: 'brand_not_found' };
  if (!brand.cancelledAt) return { ok: false, error: 'no_pending_cancellation' };
  if (brand.status === 'cancelled') {
    return { ok: false, error: 'subscription_already_terminated' };
  }

  const now = new Date();
  if (brand.stripeSubscriptionId && isStripeConfigured()) {
    try {
      await getStripe().subscriptions.update(brand.stripeSubscriptionId, {
        cancel_at_period_end: false,
      });
    } catch (err) {
      return {
        ok: false,
        error: 'stripe_reversal_failed',
        detail: err instanceof Error ? err.message : undefined,
      };
    }
  }
  await db
    .update(schema.brands)
    .set({ cancelledAt: null, updatedAt: now })
    .where(eq(schema.brands.id, brand.id));

  await db.insert(schema.auditLog).values({
    actorUserId: actor.userId,
    brandId: brand.id,
    action: 'subscription_cancel_reversed',
    entityType: 'brand',
    entityId: brand.id,
    before: { cancelledAt: brand.cancelledAt },
    after: { cancelledAt: null },
  });

  revalidatePath('/billing');
  revalidatePath('/plan');
  return { ok: true, cancelledAt: now.toISOString() };
}
