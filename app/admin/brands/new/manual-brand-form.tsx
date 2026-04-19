'use client';

import { useEffect, useState } from 'react';
import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  adminCreateManualBrandAction,
  type AdminBrandActionResult,
} from '@/app/actions/admin-brands';

export function ManualBrandForm() {
  const t = useTranslations('admin.brandNew');
  const tErrors = useTranslations('moduleErrors.admin.brandNew');
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<
    AdminBrandActionResult | undefined,
    FormData
  >(adminCreateManualBrandAction, undefined);
  const [region, setRegion] = useState<'us' | 'co'>('co');
  const currency = region === 'co' ? 'COP' : 'USD';

  useEffect(() => {
    if (state?.ok === true && state.brandId) {
      router.push(`/admin/brands/${state.brandId}`);
    }
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-3 text-sm">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-fg-3 text-xs">{t('nameLabel')}</span>
          <input
            name="name"
            required
            maxLength={200}
            className="border-fg-4/20 bg-bg-2 text-fg-1 rounded-md border px-3 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-fg-3 text-xs">{t('slugLabel')}</span>
          <input
            name="slug"
            required
            pattern="[a-z0-9][a-z0-9-]*"
            maxLength={64}
            className="border-fg-4/20 bg-bg-2 text-fg-1 rounded-md border px-3 py-1.5 font-mono"
          />
        </label>
        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-fg-3 text-xs">{t('ownerEmailLabel')}</span>
          <input
            name="ownerEmail"
            type="email"
            required
            className="border-fg-4/20 bg-bg-2 text-fg-1 rounded-md border px-3 py-1.5"
          />
          <span className="text-fg-3 text-[11px]">{t('ownerEmailHint')}</span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-fg-3 text-xs">{t('regionLabel')}</span>
          <select
            name="financeRegion"
            value={region}
            onChange={(e) => setRegion(e.target.value as 'us' | 'co')}
            className="border-fg-4/20 bg-bg-2 text-fg-1 rounded-md border px-3 py-1.5"
          >
            <option value="co">{t('regionCo')}</option>
            <option value="us">{t('regionUs')}</option>
          </select>
          <span className="text-fg-3 text-[11px]">
            {t('currencyInfo', { currency })}
          </span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-fg-3 text-xs">{t('timezoneLabel')}</span>
          <input
            name="timezone"
            defaultValue="America/Bogota"
            className="border-fg-4/20 bg-bg-2 text-fg-1 rounded-md border px-3 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-fg-3 text-xs">
            {t('fixedAmountLabel', { currency })}
          </span>
          <input
            name="fixedAmountCents"
            type="number"
            min={0}
            required
            className="border-fg-4/20 bg-bg-2 text-fg-1 rounded-md border px-3 py-1.5"
          />
          <span className="text-fg-3 text-[11px]">{t('centsHint')}</span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-fg-3 text-xs">{t('variableBpsLabel')}</span>
          <input
            name="variablePercentBps"
            type="number"
            min={0}
            max={10000}
            defaultValue={0}
            required
            className="border-fg-4/20 bg-bg-2 text-fg-1 rounded-md border px-3 py-1.5"
          />
          <span className="text-fg-3 text-[11px]">{t('bpsHint')}</span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-fg-3 text-xs">{t('cycleDayLabel')}</span>
          <input
            name="billingCycleDay"
            type="number"
            min={1}
            max={28}
            defaultValue={1}
            required
            className="border-fg-4/20 bg-bg-2 text-fg-1 rounded-md border px-3 py-1.5"
          />
        </label>
      </div>
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="bg-asaulia-blue text-fg-on-blue rounded-md px-4 py-1.5 text-sm disabled:opacity-60"
        >
          {isPending ? t('creating') : t('create')}
        </button>
        {state && state.ok === false ? (
          <span className="text-asaulia-red text-xs">{tErrors(state.error)}</span>
        ) : null}
      </div>
    </form>
  );
}
