'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import {
  requestPasswordResetAction,
  type ActionState,
  type AuthErrorCode,
  type AuthInfoCode,
} from '../actions';
import { AuthField, FormAlert, SubmitButton } from '@/components/auth/form-primitives';

export function RequestResetForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    requestPasswordResetAction,
    undefined,
  );
  const tFields = useTranslations('auth.fields');
  const tActions = useTranslations('auth.actions');
  const tAuthErrors = useTranslations('auth.errors');
  const tErrors = useTranslations('errors');

  function translateError(code: AuthErrorCode | undefined): string | null {
    if (!code) return null;
    switch (code) {
      case 'reset_too_many_requests':
        return tAuthErrors('resetTooManyRequests');
      case 'validation':
        return tAuthErrors('validation');
      case 'generic':
      default:
        return tErrors('generic');
    }
  }

  function translateInfo(code: AuthInfoCode | undefined): string | null {
    if (!code) return null;
    switch (code) {
      case 'reset_info':
        return tAuthErrors('resetInfo');
      default:
        return null;
    }
  }

  const errorMessage = translateError(state?.error);
  const infoMessage = translateInfo(state?.info);

  return (
    <form action={formAction} className="space-y-4">
      <AuthField
        label={tFields('email')}
        name="email"
        type="email"
        autoComplete="email"
        required
      />
      {errorMessage ? <FormAlert tone="error">{errorMessage}</FormAlert> : null}
      {infoMessage ? <FormAlert tone="info">{infoMessage}</FormAlert> : null}
      <SubmitButton pending={pending}>{tActions('sendResetLink')}</SubmitButton>
    </form>
  );
}
