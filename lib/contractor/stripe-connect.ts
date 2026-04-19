import 'server-only';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { getStripe, isStripeConfigured } from '@/lib/billing/stripe';
import { env } from '@/lib/env';

export type StripeConnectState = {
  accountId: string | null;
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  onboardingComplete: boolean;
};

export async function readConnectState(userId: string): Promise<StripeConnectState> {
  const [profile] = await db
    .select({
      accountId: schema.contractorProfiles.stripeConnectAccountId,
      onboardingComplete: schema.contractorProfiles.payoutOnboardingComplete,
    })
    .from(schema.contractorProfiles)
    .where(eq(schema.contractorProfiles.userId, userId))
    .limit(1);

  if (!profile || !profile.accountId) {
    return {
      accountId: profile?.accountId ?? null,
      detailsSubmitted: false,
      chargesEnabled: false,
      payoutsEnabled: false,
      onboardingComplete: profile?.onboardingComplete ?? false,
    };
  }

  if (!isStripeConfigured()) {
    return {
      accountId: profile.accountId,
      detailsSubmitted: false,
      chargesEnabled: false,
      payoutsEnabled: false,
      onboardingComplete: profile.onboardingComplete,
    };
  }

  const stripe = getStripe();
  const account = await stripe.accounts.retrieve(profile.accountId);
  return {
    accountId: profile.accountId,
    detailsSubmitted: Boolean(account.details_submitted),
    chargesEnabled: Boolean(account.charges_enabled),
    payoutsEnabled: Boolean(account.payouts_enabled),
    onboardingComplete: profile.onboardingComplete,
  };
}

export async function startStripeConnectOnboarding(params: {
  userId: string;
  email: string;
}): Promise<{ url: string }> {
  if (!isStripeConfigured()) {
    throw new Error('Stripe is not configured.');
  }
  const stripe = getStripe();

  const [existing] = await db
    .select({
      userId: schema.contractorProfiles.userId,
      accountId: schema.contractorProfiles.stripeConnectAccountId,
    })
    .from(schema.contractorProfiles)
    .where(eq(schema.contractorProfiles.userId, params.userId))
    .limit(1);

  let accountId = existing?.accountId ?? null;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      email: params.email,
      capabilities: { transfers: { requested: true } },
    });
    accountId = account.id;

    if (existing) {
      await db
        .update(schema.contractorProfiles)
        .set({ stripeConnectAccountId: accountId, updatedAt: new Date() })
        .where(eq(schema.contractorProfiles.userId, params.userId));
    } else {
      await db.insert(schema.contractorProfiles).values({
        userId: params.userId,
        stripeConnectAccountId: accountId,
      });
    }
  }

  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${env.NEXT_PUBLIC_APP_URL}/onboarding?refresh=1`,
    return_url: `${env.NEXT_PUBLIC_APP_URL}/onboarding?return=1`,
    type: 'account_onboarding',
  });

  return { url: link.url };
}

export async function refreshOnboardingComplete(userId: string): Promise<StripeConnectState> {
  const state = await readConnectState(userId);
  if (state.accountId && state.chargesEnabled && state.payoutsEnabled && !state.onboardingComplete) {
    await db
      .update(schema.contractorProfiles)
      .set({ payoutOnboardingComplete: true, status: 'active', updatedAt: new Date() })
      .where(eq(schema.contractorProfiles.userId, userId));
    return { ...state, onboardingComplete: true };
  }
  return state;
}
