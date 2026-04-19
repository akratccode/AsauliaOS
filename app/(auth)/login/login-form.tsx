'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { signInAction, type ActionState } from '../actions';
import { AuthField, SubmitButton, FormAlert } from '@/components/auth/form-primitives';

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(signInAction, undefined);
  const tFields = useTranslations('auth.fields');
  const tActions = useTranslations('auth.actions');
  const tLinks = useTranslations('auth.links');
  const tErrors = useTranslations('auth.errors');
  const tGeneric = useTranslations('errors');

  function mapError(code: string | undefined): string | null {
    if (!code) return null;
    switch (code) {
      case 'invalid_credentials':
        return tErrors('invalidCredentials');
      case 'rate_limited':
        return tErrors('rateLimited');
      case 'validation':
        return tErrors('validation');
      default:
        return tGeneric('generic');
    }
  }

  const errorMessage = mapError(state?.error);

  return (
    <form action={formAction} className="space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <AuthField label={tFields('email')} name="email" type="email" autoComplete="email" required />
      <AuthField
        label={tFields('password')}
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      {errorMessage ? <FormAlert tone="error">{errorMessage}</FormAlert> : null}
      <SubmitButton pending={pending}>{tActions('signIn')}</SubmitButton>
      <p className="text-fg-3 text-xs">
        <Link href="/reset-password" className="underline-offset-4 hover:underline">
          {tLinks('forgotPassword')}
        </Link>
      </p>
    </form>
  );
}
