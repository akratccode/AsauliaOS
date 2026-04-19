'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import {
  adminUpsertBrandContractorAllocationAction,
  type AdminCommissionPoolActionResult,
} from '@/app/actions/admin-commission-pools';

type ContractorOption = { userId: string; label: string };

export function AllocationForm({
  brandId,
  currency,
  remainingBps,
  contractors,
}: {
  brandId: string;
  currency: 'USD' | 'COP';
  remainingBps: number;
  contractors: ContractorOption[];
}) {
  const t = useTranslations('admin.commissionPool');
  const tErrors = useTranslations('moduleErrors.admin.commissionPool');
  const [state, formAction, isPending] = useActionState<
    AdminCommissionPoolActionResult | undefined,
    FormData
  >(adminUpsertBrandContractorAllocationAction, undefined);

  return (
    <form action={formAction} className="space-y-3 text-xs">
      <input type="hidden" name="brandId" value={brandId} />
      <input type="hidden" name="currency" value={currency} />
      <div className="grid gap-3 md:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-fg-3">{t('contractor')}</span>
          <select
            name="contractorUserId"
            required
            defaultValue=""
            className="border-fg-4/20 bg-bg-2 text-fg-1 rounded-md border px-2 py-1.5"
          >
            <option value="" disabled>
              {t('selectContractor')}
            </option>
            {contractors.map((c) => (
              <option key={c.userId} value={c.userId}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-fg-3">{t('allocationBps')}</span>
          <input
            name="allocationBps"
            type="number"
            min={0}
            max={remainingBps}
            required
            className="border-fg-4/20 bg-bg-2 text-fg-1 rounded-md border px-2 py-1.5"
          />
          <span className="text-fg-3 text-[11px]">
            {t('allocationBpsHint', { remaining: String(remainingBps) })}
          </span>
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={isPending}
            className="bg-asaulia-blue text-fg-on-blue w-full rounded-md px-3 py-1.5 disabled:opacity-60"
          >
            {isPending ? t('savingAllocation') : t('saveAllocation')}
          </button>
        </div>
      </div>
      {state?.ok === true ? (
        <span className="text-asaulia-green text-xs">{t('allocationSavedInfo')}</span>
      ) : null}
      {state?.ok === false ? (
        <span className="text-asaulia-red text-xs">{tErrors(state.error)}</span>
      ) : null}
    </form>
  );
}
