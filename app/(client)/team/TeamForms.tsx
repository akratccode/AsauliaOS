'use client';

import { useActionState } from 'react';
import {
  inviteTeamMemberAction,
  revokeInvitationAction,
  type TeamActionState,
} from './actions';

export function InviteForm({ disabled }: { disabled: boolean }) {
  const [state, action, pending] = useActionState<TeamActionState, FormData>(
    inviteTeamMemberAction,
    undefined,
  );

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-fg-3 uppercase tracking-[0.12em]">Email</span>
        <input
          name="email"
          type="email"
          required
          disabled={disabled || pending}
          className="border-fg-4/20 bg-bg-2 text-fg-1 w-64 rounded-md border px-2 py-1 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="text-fg-3 uppercase tracking-[0.12em]">Role</span>
        <select
          name="role"
          defaultValue="member"
          disabled={disabled || pending}
          className="border-fg-4/20 bg-bg-2 text-fg-1 rounded-md border px-2 py-1 text-sm"
        >
          <option value="member">Member</option>
          <option value="owner">Owner</option>
        </select>
      </label>
      <button
        type="submit"
        disabled={disabled || pending}
        className="bg-asaulia-blue text-fg-on-blue rounded-md px-3 py-1.5 text-sm disabled:opacity-60"
      >
        {pending ? 'Sending…' : 'Send invite'}
      </button>
      {state?.info && <p className="text-asaulia-green w-full text-xs">{state.info}</p>}
      {state?.error && <p className="text-asaulia-red w-full text-xs">{state.error}</p>}
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
  return (
    <form action={action} className="inline">
      <input type="hidden" name="invitationId" value={invitationId} />
      <button
        type="submit"
        disabled={disabled || pending}
        className="text-asaulia-red text-xs hover:underline disabled:opacity-50"
      >
        {pending ? 'Revoking…' : 'Revoke'}
      </button>
    </form>
  );
}
