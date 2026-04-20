'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import {
  adminInviteContractorAction,
  type AdminInviteContractorActionResult,
} from '@/app/actions/admin-contractors';

export function InviteContractorForm() {
  const t = useTranslations('admin.contractorInvite');
  const tErrors = useTranslations('moduleErrors.admin.contractorInvite');
  const [state, formAction, isPending] = useActionState<
    AdminInviteContractorActionResult | undefined,
    FormData
  >(adminInviteContractorAction, undefined);

  return (
    <form action={formAction} className="space-y-3 text-sm">
      <div className="grid gap-3 md:grid-cols-3">
        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-fg-3 text-xs">{t('emailLabel')}</span>
          <input
            name="email"
            type="email"
            required
            className="border-fg-4/20 bg-bg-2 text-fg-1 rounded-md border px-3 py-1.5"
          />
          <span className="text-fg-3 text-[11px]">{t('emailHint')}</span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-fg-3 text-xs">{t('fullNameLabel')}</span>
          <input
            name="fullName"
            maxLength={120}
            className="border-fg-4/20 bg-bg-2 text-fg-1 rounded-md border px-3 py-1.5"
          />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="bg-asaulia-blue text-fg-on-blue rounded-md px-3 py-1.5 text-sm disabled:opacity-60"
        >
          {isPending ? t('sending') : t('send')}
        </button>
        {state?.ok === true && state.info === 'invited' ? (
          <span className="text-asaulia-green text-xs">{t('invitedInfo')}</span>
        ) : null}
        {state?.ok === true && state.info === 'linked' ? (
          <span className="text-asaulia-green text-xs">{t('linkedInfo')}</span>
        ) : null}
        {state?.ok === false ? (
          <span className="text-asaulia-red text-xs">{tErrors(state.error)}</span>
        ) : null}
      </div>
    </form>
  );
}
