'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { overridePlanAction, type PlanOverrideState } from './actions';

export function PlanOverrideForm({ brandId }: { brandId: string }) {
  const [state, action, pending] = useActionState<PlanOverrideState, FormData>(
    overridePlanAction,
    undefined,
  );
  const t = useTranslations('admin.brandPlan');
  const tErr = useTranslations('moduleErrors.admin');
  return (
    <form action={action} className="grid gap-3 md:grid-cols-2">
      <input type="hidden" name="brandId" value={brandId} />
      <Field label={t('fixedCents')}>
        <input
          name="fixedAmountCents"
          type="number"
          min={9900}
          max={100000}
          required
          className="border-fg-4/20 bg-bg-2 text-fg-1 w-full rounded-md border px-3 py-2 text-sm"
        />
      </Field>
      <Field label={t('variableBps')}>
        <input
          name="variablePercentBps"
          type="number"
          min={700}
          max={2000}
          required
          className="border-fg-4/20 bg-bg-2 text-fg-1 w-full rounded-md border px-3 py-2 text-sm"
        />
      </Field>
      <Field label={t('effectiveFrom')}>
        <input
          name="effectiveFrom"
          type="date"
          required
          className="border-fg-4/20 bg-bg-2 text-fg-1 w-full rounded-md border px-3 py-2 text-sm"
        />
      </Field>
      <Field label={t('reasonLabel')}>
        <input
          name="reason"
          minLength={8}
          maxLength={500}
          required
          placeholder={t('reasonPlaceholder')}
          className="border-fg-4/20 bg-bg-2 text-fg-1 w-full rounded-md border px-3 py-2 text-sm"
        />
      </Field>
      <div className="md:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="bg-asaulia-blue text-fg-on-blue rounded-md px-4 py-2 text-sm disabled:opacity-60"
        >
          {pending ? t('saving') : t('save')}
        </button>
        {state && 'info' in state && (
          <p className="text-asaulia-green mt-2 text-xs">{tErr(state.info)}</p>
        )}
        {state && 'error' in state && (
          <p className="text-asaulia-red mt-2 text-xs">{tErr(state.error)}</p>
        )}
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-fg-3 mb-1 block text-xs uppercase tracking-[0.12em]">{label}</span>
      {children}
    </label>
  );
}
