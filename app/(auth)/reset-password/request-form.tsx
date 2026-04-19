'use client';

import { useActionState } from 'react';
import { requestPasswordResetAction, type ActionState } from '../actions';
import { AuthField, FormAlert, SubmitButton } from '@/components/auth/form-primitives';

export function RequestResetForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    requestPasswordResetAction,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-4">
      <AuthField label="Email" name="email" type="email" autoComplete="email" required />
      {state?.error ? <FormAlert tone="error">{state.error}</FormAlert> : null}
      {state?.info ? <FormAlert tone="info">{state.info}</FormAlert> : null}
      <SubmitButton pending={pending}>Send reset link</SubmitButton>
    </form>
  );
}
