'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import {
  adminCloseFinancePeriodAction,
  adminReopenFinancePeriodAction,
  type AdminFinancesActionResult,
} from '@/app/actions/admin-finances';

type Props = {
  financeRegion: 'us' | 'co';
  year: number;
  month: number;
  status: 'open' | 'closed';
};

export function ClosePeriodForm({ financeRegion, year, month, status }: Props) {
  const t = useTranslations('admin.financesClose');
  const tErrors = useTranslations('moduleErrors.admin.finances');
  const isClosed = status === 'closed';
  const [state, formAction, isPending] = useActionState<
    AdminFinancesActionResult | undefined,
    FormData
  >(isClosed ? adminReopenFinancePeriodAction : adminCloseFinancePeriodAction, undefined);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="financeRegion" value={financeRegion} />
      <input type="hidden" name="year" value={year} />
      <input type="hidden" name="month" value={month} />
      <button
        type="submit"
        disabled={isPending}
        className={`rounded-md px-2 py-1 text-[11px] ${
          isClosed
            ? 'border-fg-4/20 text-fg-2 hover:text-fg-1 border'
            : 'bg-asaulia-blue text-fg-on-blue'
        } disabled:opacity-60`}
      >
        {isPending
          ? isClosed
            ? t('reopening')
            : t('closing')
          : isClosed
            ? t('reopen')
            : t('close')}
      </button>
      {state?.ok === true ? (
        <span className="text-asaulia-green text-[11px]">
          {state.info === 'period_reopened' ? t('periodReopened') : t('periodClosed')}
        </span>
      ) : null}
      {state?.ok === false ? (
        <span className="text-asaulia-red text-[11px]">{tErrors(state.error)}</span>
      ) : null}
    </form>
  );
}
