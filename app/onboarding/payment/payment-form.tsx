'use client';

import { use, useActionState } from 'react';
import { createCheckoutSessionAction, type OnboardingState } from '../actions';
import { FormAlert, SubmitButton } from '@/components/auth/form-primitives';

export function PaymentForm({
  searchParams,
}: {
  searchParams: Promise<{ cancelled?: string }>;
}) {
  const params = use(searchParams);
  const [state, formAction, pending] = useActionState<OnboardingState, FormData>(
    createCheckoutSessionAction,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-4">
      {params.cancelled ? (
        <FormAlert tone="info">Payment was cancelled. Try again when you&apos;re ready.</FormAlert>
      ) : null}
      <div className="border-fg-4/15 bg-bg-1 rounded-2xl border p-6 space-y-3 text-sm">
        <p className="text-fg-2">
          You&apos;ll be redirected to Stripe to save a card. No charge until your first billing
          cycle closes.
        </p>
        <p className="text-fg-3">
          Having trouble? Reach us at{' '}
          <a className="underline underline-offset-4" href="mailto:hello@asaulia.app">
            hello@asaulia.app
          </a>
          .
        </p>
      </div>
      {state?.error ? <FormAlert tone="error">{state.error}</FormAlert> : null}
      <SubmitButton pending={pending}>Continue to Stripe</SubmitButton>
    </form>
  );
}
