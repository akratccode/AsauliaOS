'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import {
  adminDeleteRecurrenceAction,
  adminToggleRecurrenceAction,
  type AdminRecurrenceActionResult,
} from '@/app/actions/admin-recurrences';

export function RecurrenceRowActions({
  brandId,
  recurrenceId,
  active,
}: {
  brandId: string;
  recurrenceId: string;
  active: boolean;
}) {
  const t = useTranslations('admin.recurrences');
  const [, toggleAction, toggling] = useActionState<
    AdminRecurrenceActionResult | undefined,
    FormData
  >(adminToggleRecurrenceAction, undefined);
  const [, deleteAction, deleting] = useActionState<
    AdminRecurrenceActionResult | undefined,
    FormData
  >(adminDeleteRecurrenceAction, undefined);

  return (
    <div className="flex items-center justify-end gap-2">
      <form action={toggleAction}>
        <input type="hidden" name="brandId" value={brandId} />
        <input type="hidden" name="recurrenceId" value={recurrenceId} />
        <input type="hidden" name="active" value={active ? 'false' : 'true'} />
        <button
          type="submit"
          disabled={toggling}
          className="border-fg-4/20 text-fg-2 hover:bg-bg-2 rounded-md border px-2 py-0.5 text-xs disabled:opacity-60"
        >
          {active ? t('pause') : t('resume')}
        </button>
      </form>
      <form action={deleteAction}>
        <input type="hidden" name="brandId" value={brandId} />
        <input type="hidden" name="recurrenceId" value={recurrenceId} />
        <button
          type="submit"
          disabled={deleting}
          className="border-fg-4/20 text-asaulia-red hover:bg-bg-2 rounded-md border px-2 py-0.5 text-xs disabled:opacity-60"
        >
          {t('delete')}
        </button>
      </form>
    </div>
  );
}
