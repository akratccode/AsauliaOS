'use client';

import { useActionState, useState } from 'react';
import { PricingSlider } from '@/components/pricing-slider/PricingSlider';
import { changePlanAction, type PlanActionState } from './actions';

type Props = {
  currentFixedCents: number;
  currentVariableBps: number;
  projectedMonthlySalesCents: number;
  locked: boolean;
  cooldownUntil: string | null;
  effectiveFromLabel: string;
};

export function PlanChangeForm({
  currentFixedCents,
  currentVariableBps,
  projectedMonthlySalesCents,
  locked,
  cooldownUntil,
  effectiveFromLabel,
}: Props) {
  const [state, action, pending] = useActionState<PlanActionState, FormData>(
    changePlanAction,
    undefined,
  );
  const [confirming, setConfirming] = useState(false);

  if (locked) {
    return (
      <div className="border-warning/30 bg-warning/10 text-fg-2 rounded-xl border p-4 text-sm">
        Plan last changed within the cooldown window. You can change again{' '}
        {cooldownUntil ? (
          <span className="text-fg-1 font-medium">
            on {new Date(cooldownUntil).toUTCString().slice(0, 16)}.
          </span>
        ) : (
          'soon.'
        )}
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <PricingSlider
        defaultFixedCents={currentFixedCents}
        defaultProjectedMonthlySalesCents={projectedMonthlySalesCents}
      />
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <p className="text-fg-3 text-xs">
          Changes take effect on {effectiveFromLabel}. Current cycle stays on {currentVariableBps / 100}%.
        </p>
        <button
          type="submit"
          disabled={pending || confirming}
          onClick={(e) => {
            if (!confirming) {
              e.preventDefault();
              setConfirming(true);
              requestAnimationFrame(() => {
                const btn = (e.target as HTMLElement).closest('form')?.querySelector(
                  'button[type="submit"]',
                ) as HTMLButtonElement | null;
                btn?.focus();
              });
            }
          }}
          className="bg-asaulia-blue text-fg-on-blue rounded-md px-4 py-2 text-sm disabled:opacity-60"
        >
          {confirming ? (pending ? 'Scheduling…' : 'Confirm change') : 'Save plan'}
        </button>
      </div>
      {state && 'error' in state && (
        <p className="text-asaulia-red text-xs">{state.error}</p>
      )}
      {state && 'success' in state && (
        <p className="text-asaulia-green text-xs">
          Scheduled for {new Date(state.effectiveFrom).toUTCString().slice(0, 16)}.
        </p>
      )}
    </form>
  );
}
