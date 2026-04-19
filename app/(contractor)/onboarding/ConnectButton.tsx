'use client';

import { useActionState } from 'react';
import {
  refreshConnectAction,
  startConnectOnboardingAction,
  type ConnectActionState,
} from './actions';

export function StartConnectButton({ disabled }: { disabled?: boolean }) {
  const [state, action, pending] = useActionState<ConnectActionState, FormData>(
    startConnectOnboardingAction,
    undefined,
  );
  return (
    <form action={action}>
      <button
        type="submit"
        disabled={pending || disabled}
        className="bg-asaulia-blue text-fg-on-blue rounded-md px-4 py-2 text-sm disabled:opacity-60"
      >
        {pending ? 'Opening Stripe…' : 'Start Stripe Connect'}
      </button>
      {state?.error && <p className="text-asaulia-red mt-2 text-xs">{state.error}</p>}
    </form>
  );
}

export function RefreshConnectButton() {
  const [, action, pending] = useActionState<ConnectActionState, FormData>(
    refreshConnectAction,
    undefined,
  );
  return (
    <form action={action}>
      <button
        type="submit"
        disabled={pending}
        className="border-fg-4/20 text-fg-2 hover:text-fg-1 rounded-md border px-3 py-1.5 text-xs disabled:opacity-60"
      >
        {pending ? 'Checking…' : 'I finished — refresh status'}
      </button>
    </form>
  );
}
