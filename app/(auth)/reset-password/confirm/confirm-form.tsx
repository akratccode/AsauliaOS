'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import {
  confirmPasswordResetAction,
  type ActionState,
  type AuthErrorCode,
} from '../../actions';
import { AuthField, FormAlert, SubmitButton } from '@/components/auth/form-primitives';

export function ConfirmResetForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    confirmPasswordResetAction,
    undefined,
  );
  const tFields = useTranslations('auth.fields');
  const tActions = useTranslations('auth.actions');
  const tAuthErrors = useTranslations('auth.errors');
  const tErrors = useTranslations('errors');

  function translateError(code: AuthErrorCode | undefined): string | null {
    if (!code) return null;
    switch (code) {
      case 'password_too_short':
        return tAuthErrors('passwordTooShort');
      case 'reset_failed':
        return tAuthErrors('resetFailed');
      case 'validation':
        return tAuthErrors('validation');
      case 'generic':
      default:
        return tErrors('generic');
    }
  }

  const errorMessage = translateError(state?.error);

  return (
    <form action={formAction} className="space-y-4">
      <AuthField
        label={tFields('newPassword')}
        name="password"
        type="password"
        autoComplete="new-password"
        required
      />
      {errorMessage ? <FormAlert tone="error">{errorMessage}</FormAlert> : null}
      <SubmitButton pending={pending}>{tActions('saveNewPassword')}</SubmitButton>
    </form>
  );
}
