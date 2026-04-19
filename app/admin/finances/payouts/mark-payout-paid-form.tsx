'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import {
  adminMarkPayoutPaidAction,
  type AdminFinancesActionResult,
} from '@/app/actions/admin-finances';

export function MarkPayoutPaidForm({ payoutId }: { payoutId: string }) {
  const t = useTranslations('admin.financesPayouts');
  const tErrors = useTranslations('moduleErrors.admin.finances');
  const [state, formAction, isPending] = useActionState<
    AdminFinancesActionResult | undefined,
    FormData
  >(adminMarkPayoutPaidAction, undefined);

  return (
    <form action={formAction} className="flex items-center justify-end gap-2">
      <input type="hidden" name="payoutId" value={payoutId} />
      <button
        type="submit"
        disabled={isPending}
        className="bg-asaulia-blue text-fg-on-blue rounded-md px-2 py-0.5 text-[11px] disabled:opacity-60"
      >
        {isPending ? t('marking') : t('markPaid')}
      </button>
      {state?.ok === true ? (
        <span className="text-asaulia-green text-[11px]">{t('markedPaid')}</span>
      ) : null}
      {state?.ok === false ? (
        <span className="text-asaulia-red text-[11px]">{tErrors(state.error)}</span>
      ) : null}
    </form>
  );
}
