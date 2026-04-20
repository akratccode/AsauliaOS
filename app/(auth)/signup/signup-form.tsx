'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { signUpAction, type ActionState } from '../actions';
import { AuthField, SubmitButton, FormAlert } from '@/components/auth/form-primitives';

type SignupErrorCode =
  | 'account_creation_failed'
  | 'invalid_invitation'
  | 'validation'
  | 'password_too_short'
  | 'generic';

export function SignupForm({ inviteToken }: { inviteToken?: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(signUpAction, undefined);
  const tFields = useTranslations('auth.fields');
  const tActions = useTranslations('auth.actions');
  const tAuthErrors = useTranslations('auth.errors');
  const tErrors = useTranslations('errors');
  const tRole = useTranslations('auth.signup');

  function translateError(code: string | undefined): string {
    switch (code as SignupErrorCode) {
      case 'account_creation_failed':
        return tAuthErrors('accountCreationFailed');
      case 'invalid_invitation':
        return tAuthErrors('invalidInvitation');
      case 'validation':
        return tAuthErrors('validation');
      case 'password_too_short':
        return tAuthErrors('passwordTooShort');
      case 'generic':
      default:
        return tErrors('generic');
    }
  }

  return (
    <form action={formAction} className="space-y-4">
      {inviteToken ? <input type="hidden" name="inviteToken" value={inviteToken} /> : null}
      <AuthField label={tFields('fullName')} name="fullName" autoComplete="name" required />
      <AuthField label={tFields('email')} name="email" type="email" autoComplete="email" required />
      <AuthField
        label={tFields('password')}
        name="password"
        type="password"
        autoComplete="new-password"
        required
      />
      {!inviteToken ? (
        <fieldset className="space-y-2">
          <legend className="text-fg-2 text-sm">{tRole('roleLabel')}</legend>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" name="requestedRole" value="client" defaultChecked />
              <span>{tRole('roleClient')}</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="requestedRole" value="contractor" />
              <span>{tRole('roleContractor')}</span>
            </label>
          </div>
          <p className="text-fg-3 text-xs">{tRole('roleHint')}</p>
        </fieldset>
      ) : null}
      {state?.error ? <FormAlert tone="error">{translateError(state.error)}</FormAlert> : null}
      <SubmitButton pending={pending}>{tActions('createAccount')}</SubmitButton>
    </form>
  );
}
