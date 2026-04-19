'use client';

import { useActionState } from 'react';
import { confirmPasswordResetAction, type ActionState } from '../../actions';
import { AuthField, FormAlert, SubmitButton } from '@/components/auth/form-primitives';

export function ConfirmResetForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    confirmPasswordResetAction,
    undefined,
  );
  return (
    <form action={formAction} className="space-y-4">
      <AuthField
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
      />
      {state?.error ? <FormAlert tone="error">{state.error}</FormAlert> : null}
      <SubmitButton pending={pending}>Save new password</SubmitButton>
    </form>
  );
}
