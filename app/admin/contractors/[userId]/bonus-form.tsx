'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import {
  adminCreateBonusAction,
  type AdminBonusActionResult,
} from '@/app/actions/admin-bonuses';

type BrandOption = {
  id: string;
  name: string;
};

export function ContractorBonusForm({
  contractorUserId,
  brands,
  defaultPeriodStart,
  defaultPeriodEnd,
}: {
  contractorUserId: string;
  brands: BrandOption[];
  defaultPeriodStart: string;
  defaultPeriodEnd: string;
}) {
  const t = useTranslations('admin.bonuses');
  const tErrors = useTranslations('moduleErrors.admin.bonuses');
  const [state, formAction, isPending] = useActionState<
    AdminBonusActionResult | undefined,
    FormData
  >(adminCreateBonusAction, undefined);

  return (
    <form action={formAction} className="space-y-3 text-xs">
      <input type="hidden" name="contractorUserId" value={contractorUserId} />
      <div className="grid gap-3 md:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-fg-3">{t('brand')}</span>
          <select
            name="brandId"
            defaultValue=""
            className="border-fg-4/20 bg-bg-2 text-fg-1 rounded-md border px-2 py-1.5"
          >
            <option value="">{t('anyBrand')}</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-fg-3">{t('periodStart')}</span>
          <input
            type="date"
            name="periodStart"
            required
            defaultValue={defaultPeriodStart}
            className="border-fg-4/20 bg-bg-2 text-fg-1 rounded-md border px-2 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-fg-3">{t('periodEnd')}</span>
          <input
            type="date"
            name="periodEnd"
            required
            defaultValue={defaultPeriodEnd}
            className="border-fg-4/20 bg-bg-2 text-fg-1 rounded-md border px-2 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-fg-3">{t('amountCents')}</span>
          <input
            type="number"
            name="amountCents"
            required
            min={1}
            step={1}
            className="border-fg-4/20 bg-bg-2 text-fg-1 rounded-md border px-2 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-fg-3">{t('conditionType')}</span>
          <select
            name="conditionType"
            defaultValue="all_deliverables_done"
            className="border-fg-4/20 bg-bg-2 text-fg-1 rounded-md border px-2 py-1.5"
          >
            <option value="all_deliverables_done">{t('conditionAll')}</option>
            <option value="min_deliverables_done">{t('conditionMin')}</option>
            <option value="manual">{t('conditionManual')}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-fg-3">{t('conditionMinCount')}</span>
          <input
            type="number"
            name="conditionMinCount"
            min={0}
            step={1}
            className="border-fg-4/20 bg-bg-2 text-fg-1 rounded-md border px-2 py-1.5"
          />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-fg-3">{t('note')}</span>
        <input
          name="note"
          maxLength={500}
          className="border-fg-4/20 bg-bg-2 text-fg-1 rounded-md border px-2 py-1.5"
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="bg-asaulia-blue text-fg-on-blue rounded-md px-3 py-1.5 disabled:opacity-60"
        >
          {isPending ? t('creating') : t('create')}
        </button>
        {state?.ok === true ? (
          <span className="text-asaulia-green text-xs">{t('createdInfo')}</span>
        ) : null}
        {state?.ok === false ? (
          <span className="text-asaulia-red text-xs">{tErrors(state.error)}</span>
        ) : null}
      </div>
    </form>
  );
}
