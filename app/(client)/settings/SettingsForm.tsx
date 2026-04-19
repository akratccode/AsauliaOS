'use client';

import { useActionState } from 'react';
import { updateBrandSettingsAction, type SettingsActionState } from './actions';

type Props = {
  defaultName: string;
  defaultWebsite: string;
  defaultTimezone: string;
  disabled: boolean;
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
  return (
    <form action={action} className="space-y-3">
      <Field label="Brand name">
        <input
          name="name"
          defaultValue={defaultName}
          required
          disabled={disabled}
          className="border-fg-4/20 bg-bg-2 text-fg-1 w-full rounded-md border px-3 py-2 text-sm"
        />
      </Field>
      <Field label="Website">
        <input
          name="website"
          type="url"
          defaultValue={defaultWebsite}
          disabled={disabled}
          placeholder="https://"
          className="border-fg-4/20 bg-bg-2 text-fg-1 w-full rounded-md border px-3 py-2 text-sm"
        />
      </Field>
      <Field label="Timezone (IANA)">
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
        {pending ? 'Saving…' : 'Save changes'}
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
