'use client';

import { useActionState } from 'react';
import { updateContractorProfileAction, type ProfileActionState } from './actions';

type Props = {
  defaultHeadline: string;
  defaultSkills: string;
  defaultTimezone: string;
};

export function ProfileForm({ defaultHeadline, defaultSkills, defaultTimezone }: Props) {
  const [state, action, pending] = useActionState<ProfileActionState, FormData>(
    updateContractorProfileAction,
    undefined,
  );
  return (
    <form action={action} className="space-y-3">
      <Field label="Headline">
        <input
          name="headline"
          defaultValue={defaultHeadline}
          placeholder="e.g. Content lead · DTC"
          maxLength={120}
          className="border-fg-4/20 bg-bg-2 text-fg-1 w-full rounded-md border px-3 py-2 text-sm"
        />
      </Field>
      <Field label="Skills (comma-separated)">
        <input
          name="skills"
          defaultValue={defaultSkills}
          placeholder="copywriting, shopify, lifecycle"
          className="border-fg-4/20 bg-bg-2 text-fg-1 w-full rounded-md border px-3 py-2 text-sm"
        />
      </Field>
      <Field label="Timezone (IANA)">
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
        {pending ? 'Saving…' : 'Save profile'}
      </button>
      {state?.info && <p className="text-asaulia-green text-xs">{state.info}</p>}
      {state?.error && <p className="text-asaulia-red text-xs">{state.error}</p>}
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
