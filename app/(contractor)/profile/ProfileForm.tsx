'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import {
  updateContractorProfileAction,
  type ProfileActionState,
  type ContractorProfileErrorCode,
  type ContractorProfileInfoCode,
} from './actions';

type Props = {
  defaultHeadline: string;
  defaultSkills: string;
  defaultTimezone: string;
};

const ERROR_KEYS: Record<ContractorProfileErrorCode, 'profileActionInvalidInput'> = {
  profile_action_invalid_input: 'profileActionInvalidInput',
};

const INFO_KEYS: Record<ContractorProfileInfoCode, 'profileSaved'> = {
  profile_saved: 'profileSaved',
};

export function ProfileForm({ defaultHeadline, defaultSkills, defaultTimezone }: Props) {
  const [state, action, pending] = useActionState<ProfileActionState, FormData>(
    updateContractorProfileAction,
    undefined,
  );
  const t = useTranslations('contractor.profile');
  const tErr = useTranslations('moduleErrors.contractor');

  const infoMessage = state && 'info' in state ? tErr(INFO_KEYS[state.info]) : null;
  const errorMessage = state && 'error' in state ? tErr(ERROR_KEYS[state.error]) : null;

  return (
    <form action={action} className="space-y-3">
      <Field label={t('headline')}>
        <input
          name="headline"
          defaultValue={defaultHeadline}
          placeholder={t('headlineExample')}
          maxLength={120}
          className="border-fg-4/20 bg-bg-2 text-fg-1 w-full rounded-md border px-3 py-2 text-sm"
        />
      </Field>
      <Field label={t('skillsLabel')}>
        <input
          name="skills"
          defaultValue={defaultSkills}
          placeholder={t('skillsExample')}
          className="border-fg-4/20 bg-bg-2 text-fg-1 w-full rounded-md border px-3 py-2 text-sm"
        />
      </Field>
      <Field label={t('timezone')}>
        <input
          name="timezone"
          defaultValue={defaultTimezone}
          required
          className="border-fg-4/20 bg-bg-2 text-fg-1 w-full rounded-md border px-3 py-2 text-sm"
        />
      </Field>
      <button
        type="submit"
        disabled={pending}
        className="bg-asaulia-blue text-fg-on-blue rounded-md px-4 py-2 text-sm disabled:opacity-60"
      >
        {pending ? t('saving') : t('saveProfile')}
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
