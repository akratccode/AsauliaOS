'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import type { NotificationType } from '@/lib/notifications/service';
import {
  saveNotificationPreferencesAction,
  type PrefState,
  type NotificationsErrorCode,
} from './actions';

type Label = { type: NotificationType; label: string };

const initial: PrefState = undefined;

const ERROR_KEYS: Record<NotificationsErrorCode, 'checkFields'> = {
  check_fields: 'checkFields',
};

export function PreferencesForm({
  labels,
  initial: initialMap,
}: {
  labels: Label[];
  initial: Record<string, boolean>;
}) {
  const [state, formAction, pending] = useActionState(
    saveNotificationPreferencesAction,
    initial,
  );
  const t = useTranslations('client.notifications');
  const tErr = useTranslations('moduleErrors.client.notifications');

  const errorMessage =
    state && 'error' in state ? tErr(ERROR_KEYS[state.error]) : null;

  return (
    <form action={formAction} className="space-y-4">
      <table className="w-full text-sm">
        <thead className="text-fg-3 text-xs uppercase tracking-[0.12em]">
          <tr>
            <th className="pb-3 text-left">{t('notification')}</th>
            <th className="pb-3">{t('email')}</th>
            <th className="pb-3">{t('inApp')}</th>
          </tr>
        </thead>
        <tbody className="divide-fg-4/10 divide-y">
          {labels.map(({ type, label }) => (
            <tr key={type}>
              <td className="text-fg-2 py-3">{label}</td>
              <td className="py-3 text-center">
                <input
                  type="checkbox"
                  name={`${type}:email`}
                  defaultChecked={initialMap[`${type}:email`] ?? true}
                />
              </td>
              <td className="py-3 text-center">
                <input
                  type="checkbox"
                  name={`${type}:inapp`}
                  defaultChecked={initialMap[`${type}:inapp`] ?? true}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="bg-fg-1 text-bg-0 rounded-md px-4 py-2 text-sm disabled:opacity-60"
        >
          {t('savePreferences')}
        </button>
        {state && 'success' in state && (
          <span className="text-asaulia-green text-xs">{t('saved')}</span>
        )}
        {errorMessage && (
          <span className="text-asaulia-red text-xs">{errorMessage}</span>
        )}
      </div>
    </form>
  );
}
