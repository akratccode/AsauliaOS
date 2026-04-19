'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import {
  adminCreateDeliverableAction,
  type AdminDeliverableActionResult,
} from '@/app/actions/admin-deliverables';

type Contractor = {
  userId: string;
  label: string;
};

export function DeliverablePlannerForm({
  brandId,
  defaultPeriodStart,
  defaultPeriodEnd,
  contractors,
}: {
  brandId: string;
  defaultPeriodStart: string;
  defaultPeriodEnd: string;
  contractors: Contractor[];
}) {
  const t = useTranslations('admin.deliverablePlanner');
  const tErrors = useTranslations('moduleErrors.admin.deliverablePlanner');
  const [state, formAction, isPending] = useActionState<
    AdminDeliverableActionResult | undefined,
    FormData
  >(adminCreateDeliverableAction, undefined);

  return (
    <form action={formAction} className="space-y-3 text-xs">
      <input type="hidden" name="brandId" value={brandId} />
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-fg-3">{t('titleLabel')}</span>
          <input
            name="title"
            required
            maxLength={200}
            className="border-fg-4/20 bg-bg-2 text-fg-1 rounded-md border px-2 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-fg-3">{t('typeLabel')}</span>
          <select
            name="type"
            defaultValue="custom"
            className="border-fg-4/20 bg-bg-2 text-fg-1 rounded-md border px-2 py-1.5"
          >
            <option value="content_post">{t('typeContent')}</option>
            <option value="ad_creative">{t('typeAd')}</option>
            <option value="landing_page">{t('typeLanding')}</option>
            <option value="seo_article">{t('typeSeo')}</option>
            <option value="email_sequence">{t('typeEmail')}</option>
            <option value="strategy_doc">{t('typeStrategy')}</option>
            <option value="custom">{t('typeCustom')}</option>
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
          <span className="text-fg-3">{t('assignee')}</span>
          <select
            name="assigneeUserId"
            defaultValue=""
            className="border-fg-4/20 bg-bg-2 text-fg-1 rounded-md border px-2 py-1.5"
          >
            <option value="">{t('unassigned')}</option>
            {contractors.map((c) => (
              <option key={c.userId} value={c.userId}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-fg-3">{t('dueDate')}</span>
          <input
            type="date"
            name="dueDate"
            className="border-fg-4/20 bg-bg-2 text-fg-1 rounded-md border px-2 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-fg-3">{t('shareBps')}</span>
          <input
            type="number"
            name="fixedShareBps"
            min={0}
            max={10000}
            step={1}
            defaultValue={0}
            className="border-fg-4/20 bg-bg-2 text-fg-1 rounded-md border px-2 py-1.5"
          />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-fg-3">{t('description')}</span>
        <textarea
          name="description"
          maxLength={4000}
          rows={2}
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
