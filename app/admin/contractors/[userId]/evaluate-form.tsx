'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import {
  adminEvaluateBonusesAction,
  type AdminBonusActionResult,
} from '@/app/actions/admin-bonuses';

export function EvaluateBonusesForm({
  contractorUserId,
  defaultPeriodStart,
  defaultPeriodEnd,
}: {
  contractorUserId: string;
  defaultPeriodStart: string;
  defaultPeriodEnd: string;
}) {
  const t = useTranslations('admin.bonuses');
  const [state, formAction, isPending] = useActionState<
    AdminBonusActionResult | undefined,
    FormData
  >(adminEvaluateBonusesAction, undefined);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2 text-xs">
      <input type="hidden" name="contractorUserId" value={contractorUserId} />
      <label className="flex flex-col gap-1">
        <span className="text-fg-3">{t('periodStart')}</span>
        <input
          type="date"
          name="periodStart"
          defaultValue={defaultPeriodStart}
          required
          className="border-fg-4/20 bg-bg-2 text-fg-1 rounded-md border px-2 py-1.5"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-fg-3">{t('periodEnd')}</span>
        <input
          type="date"
          name="periodEnd"
          defaultValue={defaultPeriodEnd}
          required
          className="border-fg-4/20 bg-bg-2 text-fg-1 rounded-md border px-2 py-1.5"
        />
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="border-fg-4/20 text-fg-2 hover:bg-bg-2 rounded-md border px-2 py-1.5 disabled:opacity-60"
      >
        {isPending ? t('evaluating') : t('evaluate')}
      </button>
      {state?.ok === true && state.info === 'evaluated' ? (
        <span className="text-asaulia-green text-xs">
          {t('evaluatedInfo', { count: state.count ?? 0 })}
        </span>
      ) : null}
    </form>
  );
}
