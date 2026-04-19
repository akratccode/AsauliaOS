'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@/lib/db';
import { requireAuth } from '@/lib/auth/rbac';
import { PlanInputSchema } from '@/lib/pricing';
import { savePlanRecord } from '@/lib/db/plans';
import { appendSlugSuffix, slugify } from '@/lib/utils/slug';
import { env } from '@/lib/env';
import { getStripe, isStripeConfigured } from '@/lib/billing/stripe';

const BRAND_COOKIE = 'onboarding_brand_id';

const brandSchema = z.object({
  name: z.string().min(2).max(60),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .min(2)
    .max(48)
    .optional(),
  website: z.string().url().optional().or(z.literal('')),
  timezone: z.string().min(1).default('UTC'),
});

export type OnboardingErrorCode =
  | 'invalid_input'
  | 'slug_taken'
  | 'invalid_plan'
  | 'plan_mismatch'
  | 'stripe_failed'
  | 'payment_pending'
  | 'no_brand'
  | 'no_brand_restart'
  | 'brand_not_found'
  | 'no_plan'
  | 'generic';

export type OnboardingActionState =
  | { ok: true; redirectTo?: string }
  | { ok: false; error: OnboardingErrorCode }
  | undefined;

// Backwards-compatible alias for forms still importing the old name.
export type OnboardingState = OnboardingActionState;

function fail(error: OnboardingErrorCode): OnboardingActionState {
  return { ok: false, error };
}

export async function createBrandAction(
  _prev: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  const ctx = await requireAuth();

  const parsed = brandSchema.safeParse({
    name: formData.get('name'),
    slug: (formData.get('slug') as string) || undefined,
    website: (formData.get('website') as string) || '',
    timezone: (formData.get('timezone') as string) || 'UTC',
  });
  if (!parsed.success) {
    return fail('invalid_input');
  }

  let slug = parsed.data.slug ?? slugify(parsed.data.name);
  if (!slug) slug = `brand-${ctx.userId.slice(0, 6)}`;

  let attempt = 0;
  let brandId: string | null = null;
  while (attempt < 5 && !brandId) {
    const tryingSlug = attempt === 0 ? slug : appendSlugSuffix(slug, attempt);
    try {
      const [inserted] = await db
        .insert(schema.brands)
        .values({
          slug: tryingSlug,
          name: parsed.data.name,
          website: parsed.data.website || null,
          timezone: parsed.data.timezone,
          ownerUserId: ctx.userId,
          status: 'trial',
        })
        .returning({ id: schema.brands.id });
      brandId = inserted?.id ?? null;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (!message.includes('brands_slug') && !message.toLowerCase().includes('unique')) {
        throw err;
      }
      attempt++;
    }
  }

  if (!brandId) return fail('slug_taken');

  await db.insert(schema.brandMembers).values({
    brandId,
    userId: ctx.userId,
    role: 'owner',
    acceptedAt: new Date(),
  });

  await db.insert(schema.auditLog).values({
    actorUserId: ctx.userId,
    brandId,
    action: 'brand.created',
    entityType: 'brand',
    entityId: brandId,
    after: { name: parsed.data.name, slug },
  });

  const store = await cookies();
  store.set(BRAND_COOKIE, brandId, { httpOnly: true, sameSite: 'lax', path: '/' });
  redirect('/onboarding/plan');
}

const planActionSchema = z.object({
  fixedAmountCents: z.coerce.number().int(),
  variablePercentBps: z.coerce.number().int(),
});

export async function savePlanAction(
  _prev: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  const ctx = await requireAuth();
  const store = await cookies();
  const brandId = store.get(BRAND_COOKIE)?.value;
  if (!brandId) return fail('no_brand');

  const raw = planActionSchema.safeParse({
    fixedAmountCents: formData.get('fixedAmountCents'),
    variablePercentBps: formData.get('variablePercentBps'),
  });
  if (!raw.success) return fail('invalid_plan');

  const validated = PlanInputSchema.safeParse(raw.data);
  if (!validated.success) {
    return fail('plan_mismatch');
  }

  await savePlanRecord({
    brandId,
    createdByUserId: ctx.userId,
    fixedAmountCents: validated.data.fixedAmountCents,
    variablePercentBps: validated.data.variablePercentBps,
    reason: 'initial plan selected during onboarding',
  });

  redirect('/onboarding/payment');
}

export async function createCheckoutSessionAction(
  _prev: OnboardingActionState,
): Promise<OnboardingActionState> {
  const ctx = await requireAuth();
  const store = await cookies();
  const brandId = store.get(BRAND_COOKIE)?.value;
  if (!brandId) return fail('no_brand_restart');

  const [brand] = await db
    .select()
    .from(schema.brands)
    .where(eq(schema.brands.id, brandId))
    .limit(1);
  if (!brand) return fail('brand_not_found');

  const [plan] = await db
    .select()
    .from(schema.plans)
    .where(and(eq(schema.plans.brandId, brandId), isNull(schema.plans.effectiveTo)))
    .limit(1);
  if (!plan) return fail('no_plan');

  if (!isStripeConfigured()) {
    await db
      .update(schema.brands)
      .set({
        status: 'active',
        billingCycleDay: new Date().getUTCDate(),
        updatedAt: new Date(),
      })
      .where(eq(schema.brands.id, brandId));
    redirect('/onboarding/complete');
  }

  const stripe = getStripe();
  let customerId = brand.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: ctx.email,
      name: brand.name,
      metadata: { brand_id: brandId },
    });
    customerId = customer.id;
    await db
      .update(schema.brands)
      .set({ stripeCustomerId: customerId, updatedAt: new Date() })
      .where(eq(schema.brands.id, brandId));
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          product_data: { name: 'Asaulia Platform — fixed fee' },
          unit_amount: plan.fixedAmountCents,
          recurring: { interval: 'month' },
        },
      },
    ],
    success_url: `${env.NEXT_PUBLIC_APP_URL}/onboarding/complete?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.NEXT_PUBLIC_APP_URL}/onboarding/payment?cancelled=1`,
    metadata: { brand_id: brandId },
    subscription_data: { metadata: { brand_id: brandId } },
  });

  if (!session.url) return fail('stripe_failed');
  redirect(session.url);
}

export async function finalizeOnboardingAction(sessionId: string | undefined) {
  const ctx = await requireAuth();
  const store = await cookies();
  const brandId = store.get(BRAND_COOKIE)?.value;
  if (!brandId) return;

  if (isStripeConfigured() && sessionId) {
    try {
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status === 'paid' && session.subscription) {
        const subscriptionId =
          typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
        await db
          .update(schema.brands)
          .set({
            status: 'active',
            stripeSubscriptionId: subscriptionId,
            billingCycleDay: new Date().getUTCDate(),
            updatedAt: new Date(),
          })
          .where(eq(schema.brands.id, brandId));
      }
    } catch {
      // Webhook (Phase 11) is the source of truth; swallow transient Stripe errors here.
    }
  }

  await db.insert(schema.auditLog).values({
    actorUserId: ctx.userId,
    brandId,
    action: 'onboarding.completed',
    entityType: 'brand',
    entityId: brandId,
  });

  store.delete(BRAND_COOKIE);
}
