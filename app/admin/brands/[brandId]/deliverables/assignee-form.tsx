'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import {
  adminAssignDeliverableAction,
  type AdminDeliverableActionResult,
} from '@/app/actions/admin-deliverables';

type Contractor = {
  userId: string;
  label: string;
};

export function AssigneeForm({
  brandId,
  deliverableId,
  currentAssigneeUserId,
  contractors,
}: {
  brandId: string;
  deliverableId: string;
  currentAssigneeUserId: string | null;
  contractors: Contractor[];
}) {
  const t = useTranslations('admin.deliverablePlanner');
  const [, formAction, isPending] = useActionState<
    AdminDeliverableActionResult | undefined,
    FormData
  >(adminAssignDeliverableAction, undefined);

  return (
    <form action={formAction} className="flex items-center gap-1">
      <input type="hidden" name="brandId" value={brandId} />
      <input type="hidden" name="deliverableId" value={deliverableId} />
      <select
        name="assigneeUserId"
        defaultValue={currentAssigneeUserId ?? ''}
        className="border-fg-4/20 bg-bg-2 text-fg-1 rounded-md border px-1.5 py-0.5 text-xs"
      >
        <option value="">{t('unassigned')}</option>
        {contractors.map((c) => (
          <option key={c.userId} value={c.userId}>
            {c.label}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={isPending}
        className="border-fg-4/20 text-fg-2 hover:bg-bg-2 rounded-md border px-2 py-0.5 text-xs disabled:opacity-60"
      >
        {t('assign')}
      </button>
    </form>
  );
}
