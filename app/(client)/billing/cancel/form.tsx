'use client';

import { useActionState } from 'react';
import { cancelSubscriptionAction, type CancelActionState } from './actions';

const initialState: CancelActionState = undefined;

export function CancelForm() {
  const [state, formAction, pending] = useActionState(
    cancelSubscriptionAction,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-3">
      {state && 'error' in state && (
        <p className="text-asaulia-red text-sm">{state.error}</p>
      )}
      {state && 'success' in state && (
        <p className="text-asaulia-green text-sm">
          Cancellation scheduled. You can reverse it from the billing page.
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="border-asaulia-red/40 text-asaulia-red hover:bg-asaulia-red/5 rounded-md border px-4 py-2 text-sm disabled:opacity-60"
      >
        {pending ? 'Cancelling…' : 'Confirm cancellation'}
      </button>
    </form>
  );
}
