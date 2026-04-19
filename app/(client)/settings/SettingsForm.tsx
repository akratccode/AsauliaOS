'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import {
  updateBrandSettingsAction,
  type SettingsActionState,
  type SettingsErrorCode,
  type SettingsInfoCode,
} from './actions';

type Props = {
  defaultName: string;
  defaultWebsite: string;
  defaultTimezone: string;
  disabled: boolean;
};

const ERROR_KEYS: Record<
  SettingsErrorCode,
  'noActiveBrand' | 'onlyOwnerCanUpdate' | 'checkFields'
> = {
  no_active_brand: 'noActiveBrand',
  only_owner_can_update: 'onlyOwnerCanUpdate',
  check_fields: 'checkFields',
};

const INFO_KEYS: Record<SettingsInfoCode, 'settingsSaved'> = {
  settings_saved: 'settingsSaved',
};

export function SettingsForm({
  defaultName,
  defaultWebsite,
  defaultTimezone,
  disabled,
}: Props) {
  const [state, action, pending] = useActionState<SettingsActionState, FormData>(
    updateBrandSettingsAction,
    undefined,
  );
  const t = useTranslations('client.settings');
  const tErr = useTranslations('moduleErrors.client.settings');

  const infoMessage = state && 'info' in state ? tErr(INFO_KEYS[state.info]) : null;
  const errorMessage = state && 'error' in state ? tErr(ERROR_KEYS[state.error]) : null;

  return (
    <form action={action} className="space-y-3">
      <Field label={t('brandName')}>
        <input
          name="name"
          defaultValue={defaultName}
          required
          disabled={disabled}
          className="border-fg-4/20 bg-bg-2 text-fg-1 w-full rounded-md border px-3 py-2 text-sm"
        />
      </Field>
      <Field label={t('website')}>
        <input
          name="website"
          type="url"
          defaultValue={defaultWebsite}
          disabled={disabled}
          placeholder={t('websitePlaceholder')}
          className="border-fg-4/20 bg-bg-2 text-fg-1 w-full rounded-md border px-3 py-2 text-sm"
        />
      </Field>
      <Field label={t('timezone')}>
        <input
          name="timezone"
          defaultValue={defaultTimezone}
          required
          disabled={disabled}
          className="border-fg-4/20 bg-bg-2 text-fg-1 w-full rounded-md border px-3 py-2 text-sm"
        />
      </Field>
      <button
        type="submit"
        disabled={disabled || pending}
        className="bg-asaulia-blue text-fg-on-blue rounded-md px-4 py-2 text-sm disabled:opacity-60"
      >
        {pending ? t('saving') : t('saveChanges')}
      </button>
      {infoMessage && <p className="text-asaulia-green text-xs">{infoMessage}</p>}
      {errorMessage && <p className="text-asaulia-red text-xs">{errorMessage}</p>}
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
