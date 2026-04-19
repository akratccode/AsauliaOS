'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import {
  adminCreateRecurrenceAction,
  type AdminRecurrenceActionResult,
} from '@/app/actions/admin-recurrences';

type Contractor = { userId: string; label: string };

export function RecurrenceForm({
  brandId,
  contractors,
  defaultNextRunOn,
}: {
  brandId: string;
  contractors: Contractor[];
  defaultNextRunOn: string;
}) {
  const t = useTranslations('admin.recurrences');
  const tErrors = useTranslations('moduleErrors.admin.recurrences');
  const [state, formAction, isPending] = useActionState<
    AdminRecurrenceActionResult | undefined,
    FormData
  >(adminCreateRecurrenceAction, undefined);

  return (
    <form action={formAction} className="space-y-3 text-xs">
      <input type="hidden" name="brandId" value={brandId} />
      <div className="grid gap-3 md:grid-cols-3">
        <label className="flex flex-col gap-1 md:col-span-2">
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
            <option value="content_post">content_post</option>
            <option value="ad_creative">ad_creative</option>
            <option value="landing_page">landing_page</option>
            <option value="seo_article">seo_article</option>
            <option value="email_sequence">email_sequence</option>
            <option value="strategy_doc">strategy_doc</option>
            <option value="custom">custom</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-fg-3">{t('frequency')}</span>
          <select
            name="frequency"
            defaultValue="weekly"
            className="border-fg-4/20 bg-bg-2 text-fg-1 rounded-md border px-2 py-1.5"
          >
            <option value="daily">{t('frequencyDaily')}</option>
            <option value="weekly">{t('frequencyWeekly')}</option>
            <option value="monthly">{t('frequencyMonthly')}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-fg-3">{t('intervalCount')}</span>
          <input
            type="number"
            name="intervalCount"
            defaultValue={1}
            min={1}
            max={365}
            className="border-fg-4/20 bg-bg-2 text-fg-1 rounded-md border px-2 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-fg-3">{t('nextRunOn')}</span>
          <input
            type="date"
            name="nextRunOn"
            required
            defaultValue={defaultNextRunOn}
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
          <span className="text-fg-3">{t('shareBps')}</span>
          <input
            type="number"
            name="fixedShareBps"
            min={0}
            max={10000}
            defaultValue={0}
            className="border-fg-4/20 bg-bg-2 text-fg-1 rounded-md border px-2 py-1.5"
          />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-fg-3">{t('description')}</span>
        <textarea
          name="description"
          rows={2}
          maxLength={4000}
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
          <span className="text-asaulia-green">{t('createdInfo')}</span>
        ) : null}
        {state?.ok === false ? (
          <span className="text-asaulia-red">{tErrors(state.error)}</span>
        ) : null}
      </div>
    </form>
  );
}
