'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/rbac';
import { db, schema } from '@/lib/db';
import { resolveActiveBrand, requireClientBrandAccess } from '@/lib/brand/context';
import { getStripe, isStripeConfigured } from '@/lib/billing/stripe';

export type CancelActionState =
  | { error: string }
  | { success: true; cancelledAt: string }
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
  if (!active) return { error: 'No active brand' };
  const { role } = await requireClientBrandAccess(actor, active.id);
  if (role !== 'owner' && actor.globalRole !== 'admin' && actor.globalRole !== 'operator') {
    return { error: 'Only the brand owner can cancel the subscription.' };
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
  if (!brand) return { error: 'Brand not found' };
  if (brand.status === 'cancelled') return { error: 'Subscription already cancelled.' };

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
      return { error: err instanceof Error ? err.message : 'Stripe cancel failed' };
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
  return { success: true, cancelledAt: now.toISOString() };
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
  if (!active) return { error: 'No active brand' };
  const { role } = await requireClientBrandAccess(actor, active.id);
  if (role !== 'owner' && actor.globalRole !== 'admin' && actor.globalRole !== 'operator') {
    return { error: 'Only the brand owner can reverse the cancellation.' };
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
  if (!brand) return { error: 'Brand not found' };
  if (!brand.cancelledAt) return { error: 'No pending cancellation.' };
  if (brand.status === 'cancelled') return { error: 'Subscription already terminated.' };

  const now = new Date();
  if (brand.stripeSubscriptionId && isStripeConfigured()) {
    try {
      await getStripe().subscriptions.update(brand.stripeSubscriptionId, {
        cancel_at_period_end: false,
      });
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Stripe reversal failed' };
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
  return { success: true, cancelledAt: now.toISOString() };
}
