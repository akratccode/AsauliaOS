'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import {
  adminAssignContractorToBrandAction,
  type AdminBrandContractorActionResult,
} from '@/app/actions/admin-brand-contractors';

type ContractorOption = {
  userId: string;
  label: string;
};

export function AssignContractorForm({
  brandId,
  contractors,
}: {
  brandId: string;
  contractors: ContractorOption[];
}) {
  const t = useTranslations('admin.brandContractors');
  const tErrors = useTranslations('moduleErrors.admin.brandContractors');
  const [state, formAction, isPending] = useActionState<
    AdminBrandContractorActionResult | undefined,
    FormData
  >(adminAssignContractorToBrandAction, undefined);

  return (
    <form action={formAction} className="space-y-3 text-xs">
      <input type="hidden" name="brandId" value={brandId} />
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
          <span className="text-fg-3">{t('role')}</span>
          <input
            name="role"
            required
            maxLength={64}
            placeholder={t('rolePlaceholder')}
            className="border-fg-4/20 bg-bg-2 text-fg-1 rounded-md border px-2 py-1.5"
          />
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={isPending}
            className="bg-asaulia-blue text-fg-on-blue w-full rounded-md px-3 py-1.5 disabled:opacity-60"
          >
            {isPending ? t('assigning') : t('assign')}
          </button>
        </div>
      </div>
      {state?.ok === true ? (
        <span className="text-asaulia-green text-xs">{t('assignedInfo')}</span>
      ) : null}
      {state?.ok === false ? (
        <span className="text-asaulia-red text-xs">{tErrors(state.error)}</span>
      ) : null}
    </form>
  );
}
