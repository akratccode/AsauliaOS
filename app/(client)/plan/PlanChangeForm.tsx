'use client';

import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import { PricingSliderLazy as PricingSlider } from '@/components/pricing-slider/PricingSliderLazy';
import { changePlanAction, type PlanActionState, type PlanErrorCode } from './actions';

type Props = {
  currentFixedCents: number;
  currentVariableBps: number;
  projectedMonthlySalesCents: number;
  locked: boolean;
  cooldownUntil: string | null;
  effectiveFromLabel: string;
};

type PlanErrorMsgKey =
  | 'noActiveBrand'
  | 'onlyOwnerCanChange'
  | 'selectValidPlan'
  | 'planChangeCooldown';

const errorKeyMap: Record<PlanErrorCode, PlanErrorMsgKey> = {
  no_active_brand: 'noActiveBrand',
  only_owner_can_change: 'onlyOwnerCanChange',
  select_valid_plan: 'selectValidPlan',
  plan_change_cooldown: 'planChangeCooldown',
  plan_change_validation: 'selectValidPlan',
};

export function PlanChangeForm({
  currentFixedCents,
  currentVariableBps,
  projectedMonthlySalesCents,
  locked,
  cooldownUntil,
  effectiveFromLabel,
}: Props) {
  const t = useTranslations('client.plan');
  const tErr = useTranslations('moduleErrors.client.plan');
  const [state, action, pending] = useActionState<PlanActionState, FormData>(
    changePlanAction,
    undefined,
  );
  const [confirming, setConfirming] = useState(false);

  if (locked) {
    return (
      <div className="border-warning/30 bg-warning/10 text-fg-2 rounded-xl border p-4 text-sm">
        {cooldownUntil
          ? t('planCooldown', { date: new Date(cooldownUntil).toUTCString().slice(0, 16) })
          : t('planCooldownSoon')}
      </div>
    );
  }

  const errorMessage = (() => {
    if (!state || state.ok) return null;
    const key = errorKeyMap[state.error];
    const base = tErr(key);
    return state.detail ? `${base} (${state.detail})` : base;
  })();

  return (
    <form action={action} className="space-y-4">
      <PricingSlider
        defaultFixedCents={currentFixedCents}
        defaultProjectedMonthlySalesCents={projectedMonthlySalesCents}
      />
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <p className="text-fg-3 text-xs">
          {t('changesEffective', {
            date: effectiveFromLabel,
            variable: currentVariableBps / 100,
          })}
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
          {confirming ? (pending ? t('scheduling') : t('confirmChange')) : t('savePlan')}
        </button>
      </div>
      {errorMessage && (
        <p className="text-asaulia-red text-xs">{errorMessage}</p>
      )}
      {state && state.ok && (
        <p className="text-asaulia-green text-xs">
          {t('scheduledFor', { date: new Date(state.effectiveFrom).toUTCString().slice(0, 16) })}
        </p>
      )}
    </form>
  );
}
