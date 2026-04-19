'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import {
  adminSetBrandCommissionPoolAction,
  type AdminCommissionPoolActionResult,
} from '@/app/actions/admin-commission-pools';

type PoolCurrency = 'USD' | 'COP';
type PoolScope = 'monthly' | 'quarterly' | 'per_project';

type Initial = {
  currency: PoolCurrency;
  scope: PoolScope;
  poolBps: number | null;
  poolAmountCents: number | null;
  note: string;
};

export function PoolForm({ brandId, initial }: { brandId: string; initial: Initial }) {
  const t = useTranslations('admin.commissionPool');
  const tErrors = useTranslations('moduleErrors.admin.commissionPool');
  const [state, formAction, isPending] = useActionState<
    AdminCommissionPoolActionResult | undefined,
    FormData
  >(adminSetBrandCommissionPoolAction, undefined);

  return (
    <form action={formAction} className="space-y-3 text-xs">
      <input type="hidden" name="brandId" value={brandId} />
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-fg-3">{t('currency')}</span>
          <select
            name="currency"
            defaultValue={initial.currency}
            className="border-fg-4/20 bg-bg-2 text-fg-1 rounded-md border px-2 py-1.5"
          >
            <option value="USD">{t('currencyUSD')}</option>
            <option value="COP">{t('currencyCOP')}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-fg-3">{t('scope')}</span>
          <select
            name="scope"
            defaultValue={initial.scope}
            className="border-fg-4/20 bg-bg-2 text-fg-1 rounded-md border px-2 py-1.5"
          >
            <option value="monthly">{t('scopeMonthly')}</option>
            <option value="quarterly">{t('scopeQuarterly')}</option>
            <option value="per_project">{t('scopePerProject')}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-fg-3">{t('poolBps')}</span>
          <input
            name="poolBps"
            type="number"
            min={0}
            max={10000}
            defaultValue={initial.poolBps ?? ''}
            className="border-fg-4/20 bg-bg-2 text-fg-1 rounded-md border px-2 py-1.5"
          />
          <span className="text-fg-3 text-[11px]">{t('poolBpsHint')}</span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-fg-3">{t('poolAmountCents')}</span>
          <input
            name="poolAmountCents"
            type="number"
            min={0}
            defaultValue={initial.poolAmountCents ?? ''}
            className="border-fg-4/20 bg-bg-2 text-fg-1 rounded-md border px-2 py-1.5"
          />
          <span className="text-fg-3 text-[11px]">{t('poolAmountHint')}</span>
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-fg-3">{t('noteLabel')}</span>
        <input
          name="note"
          maxLength={500}
          placeholder={t('notePlaceholder')}
          defaultValue={initial.note}
          className="border-fg-4/20 bg-bg-2 text-fg-1 rounded-md border px-2 py-1.5"
        />
      </label>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="bg-asaulia-blue text-fg-on-blue rounded-md px-3 py-1.5 disabled:opacity-60"
        >
          {isPending ? t('saving') : t('save')}
        </button>
        {state?.ok === true ? (
          <span className="text-asaulia-green text-xs">{t('poolSavedInfo')}</span>
        ) : null}
        {state?.ok === false ? (
          <span className="text-asaulia-red text-xs">{tErrors(state.error)}</span>
        ) : null}
      </div>
    </form>
  );
}
