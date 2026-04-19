'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import {
  adminEndBrandContractorAllocationAction,
  type AdminCommissionPoolActionResult,
} from '@/app/actions/admin-commission-pools';

export function EndAllocationForm({
  allocationId,
  brandId,
}: {
  allocationId: string;
  brandId: string;
}) {
  const t = useTranslations('admin.commissionPool');
  const tErrors = useTranslations('moduleErrors.admin.commissionPool');
  const [state, formAction, isPending] = useActionState<
    AdminCommissionPoolActionResult | undefined,
    FormData
  >(adminEndBrandContractorAllocationAction, undefined);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="allocationId" value={allocationId} />
      <input type="hidden" name="brandId" value={brandId} />
      <button
        type="submit"
        disabled={isPending}
        className="border-fg-4/20 text-fg-2 hover:text-fg-1 rounded-md border px-2 py-0.5 text-[11px] disabled:opacity-60"
      >
        {isPending ? t('endingAllocation') : t('endAllocation')}
      </button>
      {state?.ok === false ? (
        <span className="text-asaulia-red text-[11px]">{tErrors(state.error)}</span>
      ) : null}
    </form>
  );
}
