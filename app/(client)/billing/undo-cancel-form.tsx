'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import {
  undoCancelSubscriptionAction,
  type BillingErrorCode,
  type CancelActionState,
} from './cancel/actions';

const initialState: CancelActionState = undefined;

type BillingErrorMsgKey =
  | 'noActiveBrand'
  | 'brandNotFound'
  | 'subscriptionAlreadyCancelled'
  | 'subscriptionAlreadyTerminated'
  | 'noPendingCancellation'
  | 'stripeCancelFailed'
  | 'stripeReversalFailed';

const errorKeyMap: Record<BillingErrorCode, BillingErrorMsgKey> = {
  no_active_brand: 'noActiveBrand',
  brand_not_found: 'brandNotFound',
  only_owner_can_cancel: 'noActiveBrand', // overridden with fallback text below
  only_owner_can_reverse: 'noActiveBrand', // overridden with fallback text below
  subscription_already_cancelled: 'subscriptionAlreadyCancelled',
  subscription_already_terminated: 'subscriptionAlreadyTerminated',
  no_pending_cancellation: 'noPendingCancellation',
  stripe_cancel_failed: 'stripeCancelFailed',
  stripe_reversal_failed: 'stripeReversalFailed',
};

export function UndoCancelForm() {
  const tErr = useTranslations('moduleErrors.client.billing');
  const [state, formAction, pending] = useActionState(
    undoCancelSubscriptionAction,
    initialState,
  );

  const errorMessage = (() => {
    if (!state || state.ok) return null;
    if (state.error === 'only_owner_can_cancel') {
       
      return 'Only the brand owner can cancel the subscription.';
    }
    if (state.error === 'only_owner_can_reverse') {
       
      return 'Only the brand owner can reverse the cancellation.';
    }
    const key = errorKeyMap[state.error];
    const base = tErr(key);
    return state.detail ? `${base} (${state.detail})` : base;
  })();

  return (
    <form action={formAction} className="mt-3">
      {errorMessage && (
        <p className="text-asaulia-red mb-2 text-xs">{errorMessage}</p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="border-fg-4/20 text-fg-2 hover:text-fg-1 rounded-md border px-3 py-1.5 text-xs disabled:opacity-60"
      >
        { }
        {pending ? 'Reversing…' : 'Reverse cancellation'}
      </button>
    </form>
  );
}
