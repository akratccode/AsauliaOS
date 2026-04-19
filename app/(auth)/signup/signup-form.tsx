'use client';

import { useActionState } from 'react';
import { signUpAction, type ActionState } from '../actions';
import { AuthField, SubmitButton, FormAlert } from '@/components/auth/form-primitives';

export function SignupForm({ inviteToken }: { inviteToken?: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(signUpAction, undefined);

  return (
    <form action={formAction} className="space-y-4">
      {inviteToken ? <input type="hidden" name="inviteToken" value={inviteToken} /> : null}
      <AuthField label="Full name" name="fullName" autoComplete="name" required />
      <AuthField label="Email" name="email" type="email" autoComplete="email" required />
      <AuthField
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
      />
      {state?.error ? <FormAlert tone="error">{state.error}</FormAlert> : null}
      <SubmitButton pending={pending}>Create account</SubmitButton>
    </form>
  );
}
