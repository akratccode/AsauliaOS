'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';

type FieldProps = {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  defaultValue?: string;
};

export function AuthField({ label, name, type = 'text', ...rest }: FieldProps) {
  return (
    <label className="block space-y-1.5">
      <span className="text-fg-2 text-xs uppercase tracking-[0.12em]">{label}</span>
      <input
        name={name}
        type={type}
        className="border-fg-4/20 bg-bg-1 text-fg-1 placeholder:text-fg-4 focus:border-asaulia-blue focus:ring-asaulia-blue/30 block w-full rounded-md border px-3 py-2 text-sm outline-none transition focus:ring-2"
        {...rest}
      />
    </label>
  );
}

export function SubmitButton({
  pending,
  children,
  pendingLabel,
}: {
  pending: boolean;
  children: ReactNode;
  pendingLabel?: ReactNode;
}) {
  const t = useTranslations('forms');
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-asaulia-blue text-fg-1 hover:bg-asaulia-blue/90 inline-flex w-full items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? (pendingLabel ?? t('submitting')) : children}
    </button>
  );
}

export function FormAlert({
  tone,
  children,
}: {
  tone: 'error' | 'info';
  children: ReactNode;
}) {
  const toneClass =
    tone === 'error'
      ? 'border-red-500/30 bg-red-500/10 text-red-200'
      : 'border-asaulia-blue/30 bg-asaulia-blue/10 text-fg-1';
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-md border px-3 py-2 text-sm ${toneClass}`}>
      {children}
    </div>
  );
}
