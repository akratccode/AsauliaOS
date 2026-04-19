'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import {
  inviteTeamMemberAction,
  revokeInvitationAction,
  type TeamActionState,
  type TeamErrorCode,
} from './actions';

const ERROR_KEYS: Record<
  TeamErrorCode,
  | 'noActiveBrand'
  | 'onlyOwnerCanInvite'
  | 'validEmailAndRole'
  | 'onlyOwnerCanRevoke'
  | 'invalidRequest'
> = {
  no_active_brand: 'noActiveBrand',
  only_owner_can_invite: 'onlyOwnerCanInvite',
  valid_email_and_role: 'validEmailAndRole',
  only_owner_can_revoke: 'onlyOwnerCanRevoke',
  invalid_request: 'invalidRequest',
};

export function InviteForm({ disabled }: { disabled: boolean }) {
  const [state, action, pending] = useActionState<TeamActionState, FormData>(
    inviteTeamMemberAction,
    undefined,
  );
  const t = useTranslations('client.team');
  const tErr = useTranslations('moduleErrors.client.team');

  const infoMessage =
    state && 'info' in state && state.info === 'invitation_sent'
      ? tErr('invitationSent', { email: state.email })
      : state && 'info' in state && state.info === 'invitation_revoked'
        ? tErr('invitationRevoked')
        : null;
  const errorMessage = state && 'error' in state ? tErr(ERROR_KEYS[state.error]) : null;

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-fg-3 uppercase tracking-[0.12em]">{t('emailLabel')}</span>
        <input
          name="email"
          type="email"
          required
          disabled={disabled || pending}
          className="border-fg-4/20 bg-bg-2 text-fg-1 w-64 rounded-md border px-2 py-1 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-fg-3 uppercase tracking-[0.12em]">{t('roleLabel')}</span>
        <select
          name="role"
          defaultValue="member"
          disabled={disabled || pending}
          className="border-fg-4/20 bg-bg-2 text-fg-1 rounded-md border px-2 py-1 text-sm"
        >
          <option value="member">{t('member')}</option>
          <option value="owner">{t('owner')}</option>
        </select>
      </label>
      <button
        type="submit"
        disabled={disabled || pending}
        className="bg-asaulia-blue text-fg-on-blue rounded-md px-3 py-1.5 text-sm disabled:opacity-60"
      >
        {pending ? t('sending') : t('sendInvite')}
      </button>
      {infoMessage && <p className="text-asaulia-green w-full text-xs">{infoMessage}</p>}
      {errorMessage && <p className="text-asaulia-red w-full text-xs">{errorMessage}</p>}
    </form>
  );
}

export function RevokeInviteButton({
  invitationId,
  disabled,
}: {
  invitationId: string;
  disabled: boolean;
}) {
  const [, action, pending] = useActionState<TeamActionState, FormData>(
    revokeInvitationAction,
    undefined,
  );
  const t = useTranslations('client.team');
  return (
    <form action={action} className="inline">
      <input type="hidden" name="invitationId" value={invitationId} />
      <button
        type="submit"
        disabled={disabled || pending}
        className="text-asaulia-red text-xs hover:underline disabled:opacity-50"
      >
        {pending ? t('revoking') : t('revoke')}
      </button>
    </form>
  );
}
