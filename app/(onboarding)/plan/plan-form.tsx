'use client';

import { useActionState } from 'react';
import { savePlanAction, type OnboardingState } from '../actions';
import { PricingSlider } from '@/components/pricing-slider/PricingSlider';
import { FormAlert, SubmitButton } from '@/components/auth/form-primitives';

export function PlanForm() {
  const [state, formAction, pending] = useActionState<OnboardingState, FormData>(
    savePlanAction,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-6">
      <PricingSlider />
      {state?.error ? <FormAlert tone="error">{state.error}</FormAlert> : null}
      <SubmitButton pending={pending}>Continue to payment</SubmitButton>
    </form>
  );
}
