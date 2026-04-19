'use client';

import { use, useActionState } from 'react';
import { useTranslations } from 'next-intl';
import {
  createCheckoutSessionAction,
  type OnboardingActionState,
  type OnboardingErrorCode,
} from '../actions';
import { FormAlert, SubmitButton } from '@/components/auth/form-primitives';

type ErrorMessageKey =
  | 'invalidInput'
  | 'slugTaken'
  | 'invalidPlan'
  | 'planMismatch'
  | 'stripeFailed'
  | 'paymentPending'
  | 'noBrand'
  | 'noBrandRestart'
  | 'brandNotFound'
  | 'noPlan'
  | 'generic';

const ERROR_KEY_MAP: Record<OnboardingErrorCode, ErrorMessageKey> = {
  invalid_input: 'invalidInput',
  slug_taken: 'slugTaken',
  invalid_plan: 'invalidPlan',
  plan_mismatch: 'planMismatch',
  stripe_failed: 'stripeFailed',
  payment_pending: 'paymentPending',
  no_brand: 'noBrand',
  no_brand_restart: 'noBrandRestart',
  brand_not_found: 'brandNotFound',
  no_plan: 'noPlan',
  generic: 'generic',
};

export function PaymentForm({
  searchParams,
}: {
  searchParams: Promise<{ cancelled?: string }>;
}) {
  const params = use(searchParams);
  const t = useTranslations('onboarding.payment');
  const tErrors = useTranslations('onboarding.errors');
  const [state, formAction, pending] = useActionState<OnboardingActionState, FormData>(
    createCheckoutSessionAction,
    undefined,
  );

  const errorKey = state && !state.ok ? ERROR_KEY_MAP[state.error] : null;

  return (
    <form action={formAction} className="space-y-4">
      {params.cancelled ? <FormAlert tone="info">{t('cancelledInfo')}</FormAlert> : null}
      <div className="border-fg-4/15 bg-bg-1 rounded-2xl border p-6 space-y-3 text-sm">
        <p className="text-fg-2">{t('stripeInfo')}</p>
        <p className="text-fg-3">
          {t('supportText')}{' '}
          <a className="underline underline-offset-4" href="mailto:hello@asaulia.app">
            hello@asaulia.app
          </a>
          .
        </p>
      </div>
      {errorKey ? <FormAlert tone="error">{tErrors(errorKey)}</FormAlert> : null}
      <SubmitButton pending={pending}>{t('submit')}</SubmitButton>
    </form>
  );
}
