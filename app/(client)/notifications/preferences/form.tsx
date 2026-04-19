'use client';

import { useActionState } from 'react';
import type { NotificationType } from '@/lib/notifications/service';
import {
  saveNotificationPreferencesAction,
  type PrefState,
} from './actions';

type Label = { type: NotificationType; label: string };

const initial: PrefState = undefined;

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

  return (
    <form action={formAction} className="space-y-4">
      <table className="w-full text-sm">
        <thead className="text-fg-3 text-xs uppercase tracking-[0.12em]">
          <tr>
            <th className="pb-3 text-left">Notification</th>
            <th className="pb-3">Email</th>
            <th className="pb-3">In-app</th>
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
          {pending ? 'Saving…' : 'Save preferences'}
        </button>
        {state && 'success' in state && (
          <span className="text-asaulia-green text-xs">Saved.</span>
        )}
        {state && 'error' in state && (
          <span className="text-asaulia-red text-xs">{state.error}</span>
        )}
      </div>
    </form>
  );
}
