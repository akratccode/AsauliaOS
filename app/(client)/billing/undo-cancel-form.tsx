'use client';

import { useActionState } from 'react';
import {
  undoCancelSubscriptionAction,
  type CancelActionState,
} from './cancel/actions';

const initialState: CancelActionState = undefined;

export function UndoCancelForm() {
  const [state, formAction, pending] = useActionState(
    undoCancelSubscriptionAction,
    initialState,
  );
  return (
    <form action={formAction} className="mt-3">
      {state && 'error' in state && (
        <p className="text-asaulia-red mb-2 text-xs">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="border-fg-4/20 text-fg-2 hover:text-fg-1 rounded-md border px-3 py-1.5 text-xs disabled:opacity-60"
      >
        {pending ? 'Reversing…' : 'Reverse cancellation'}
      </button>
    </form>
  );
}
