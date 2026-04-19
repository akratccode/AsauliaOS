'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { signInAction, type ActionState } from '../actions';
import { AuthField, SubmitButton, FormAlert } from '@/components/auth/form-primitives';

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(signInAction, undefined);

  return (
    <form action={formAction} className="space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <AuthField label="Email" name="email" type="email" autoComplete="email" required />
      <AuthField label="Password" name="password" type="password" autoComplete="current-password" required />
      {state?.error ? <FormAlert tone="error">{state.error}</FormAlert> : null}
      <SubmitButton pending={pending}>Sign in</SubmitButton>
      <p className="text-fg-3 text-xs">
        <Link href="/reset-password" className="underline-offset-4 hover:underline">
          Forgot your password?
        </Link>
      </p>
    </form>
  );
}
