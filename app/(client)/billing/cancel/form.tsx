'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import {
  cancelSubscriptionAction,
  type BillingErrorCode,
  type BillingInfoCode,
  type CancelActionState,
} from './actions';

const initialState: CancelActionState = undefined;

type BillingErrorMsgKey =
  | 'noActiveBrand'
  | 'brandNotFound'
  | 'subscriptionAlreadyCancelled'
  | 'subscriptionAlreadyTerminated'
  | 'noPendingCancellation'
  | 'stripeCancelFailed'
  | 'stripeReversalFailed';

type BillingInfoMsgKey = 'cancellationScheduled';

const errorKeyMap: Record<BillingErrorCode, BillingErrorMsgKey> = {
  no_active_brand: 'noActiveBrand',
  brand_not_found: 'brandNotFound',
  only_owner_can_cancel: 'noActiveBrand', // no dedicated key; overridden with fallback text below
  only_owner_can_reverse: 'noActiveBrand', // no dedicated key; overridden with fallback text below
  subscription_already_cancelled: 'subscriptionAlreadyCancelled',
  subscription_already_terminated: 'subscriptionAlreadyTerminated',
  no_pending_cancellation: 'noPendingCancellation',
  stripe_cancel_failed: 'stripeCancelFailed',
  stripe_reversal_failed: 'stripeReversalFailed',
};

const infoKeyMap: Record<BillingInfoCode, BillingInfoMsgKey> = {
  cancellation_scheduled: 'cancellationScheduled',
};

export function CancelForm() {
  const tErr = useTranslations('moduleErrors.client.billing');
  const t = useTranslations('client.billing');
  const [state, formAction, pending] = useActionState(
    cancelSubscriptionAction,
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
    <form action={formAction} className="space-y-3">
      {errorMessage && (
        <p className="text-asaulia-red text-sm">{errorMessage}</p>
      )}
      {state && state.ok && state.info && (
        <p className="text-asaulia-green text-sm">
          {tErr(infoKeyMap[state.info])}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="border-asaulia-red/40 text-asaulia-red hover:bg-asaulia-red/5 rounded-md border px-4 py-2 text-sm disabled:opacity-60"
      >
        { }
        {pending ? 'Cancelling…' : t('cancelSubscription')}
      </button>
    </form>
  );
}
