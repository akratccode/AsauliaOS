'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import {
  adminEndBrandAssignmentAction,
  type AdminBrandContractorActionResult,
} from '@/app/actions/admin-brand-contractors';

export function EndAssignmentForm({
  assignmentId,
  brandId,
}: {
  assignmentId: string;
  brandId: string;
}) {
  const t = useTranslations('admin.brandContractors');
  const tErrors = useTranslations('moduleErrors.admin.brandContractors');
  const [state, formAction, isPending] = useActionState<
    AdminBrandContractorActionResult | undefined,
    FormData
  >(adminEndBrandAssignmentAction, undefined);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <input type="hidden" name="brandId" value={brandId} />
      <button
        type="submit"
        disabled={isPending}
        className="border-fg-4/20 text-fg-2 hover:text-fg-1 rounded-md border px-2 py-0.5 text-[11px] disabled:opacity-60"
      >
        {isPending ? t('ending') : t('end')}
      </button>
      {state?.ok === false ? (
        <span className="text-asaulia-red text-[11px]">{tErrors(state.error)}</span>
      ) : null}
    </form>
  );
}
