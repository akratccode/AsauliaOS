'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import {
  savePlanAction,
  type OnboardingActionState,
  type OnboardingErrorCode,
} from '../actions';
import { PricingSliderLazy as PricingSlider } from '@/components/pricing-slider/PricingSliderLazy';
import { FormAlert, SubmitButton } from '@/components/auth/form-primitives';

// Map server action error codes to keys inside `onboarding.errors.*`.
const ERROR_KEY_MAP = {
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
} as const satisfies Record<OnboardingErrorCode, string>;

export function PlanForm() {
  const t = useTranslations('onboarding.plan');
  const tErrors = useTranslations('onboarding.errors');
  const [state, formAction, pending] = useActionState<OnboardingActionState, FormData>(
    savePlanAction,
    undefined,
  );

  const errorKey =
    state && state.ok === false ? (ERROR_KEY_MAP[state.error] ?? 'generic') : null;

  return (
    <form action={formAction} className="space-y-6">
      <PricingSlider />
      {errorKey ? <FormAlert tone="error">{tErrors(errorKey)}</FormAlert> : null}
      <SubmitButton pending={pending}>{t('submit')}</SubmitButton>
    </form>
  );
}
