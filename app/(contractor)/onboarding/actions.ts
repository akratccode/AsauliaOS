'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth/rbac';
import {
  refreshOnboardingComplete,
  startStripeConnectOnboarding,
} from '@/lib/contractor/stripe-connect';
import { isStripeConfigured } from '@/lib/billing/stripe';

export type ConnectActionState = { error?: string } | undefined;

export async function startConnectOnboardingAction(
  _prev: ConnectActionState,
  _formData: FormData,
): Promise<ConnectActionState> {
  const actor = await requireAuth();
  if (!isStripeConfigured()) {
    return { error: 'Stripe is not configured in this environment.' };
  }
  const { url } = await startStripeConnectOnboarding({
    userId: actor.userId,
    email: actor.email,
  });
  redirect(url);
}

export async function refreshConnectAction(
  _prev: ConnectActionState,
  _formData: FormData,
): Promise<ConnectActionState> {
  const actor = await requireAuth();
  await refreshOnboardingComplete(actor.userId);
  revalidatePath('/onboarding');
  revalidatePath('/profile');
  return undefined;
}
