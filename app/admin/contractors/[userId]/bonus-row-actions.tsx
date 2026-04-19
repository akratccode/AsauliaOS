'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import {
  adminMarkBonusPaidAction,
  adminResolveBonusAction,
  type AdminBonusActionResult,
} from '@/app/actions/admin-bonuses';

export function BonusRowActions({
  bonusId,
  contractorUserId,
  status,
}: {
  bonusId: string;
  contractorUserId: string;
  status: 'pending' | 'earned' | 'forfeited' | 'paid';
}) {
  const t = useTranslations('admin.bonuses');
  const [, resolveAction, resolving] = useActionState<
    AdminBonusActionResult | undefined,
    FormData
  >(adminResolveBonusAction, undefined);
  const [, payAction, paying] = useActionState<
    AdminBonusActionResult | undefined,
    FormData
  >(adminMarkBonusPaidAction, undefined);

  if (status === 'paid') {
    return <span className="text-fg-3 text-xs">—</span>;
  }

  if (status === 'pending') {
    return (
      <div className="flex items-center gap-2">
        <form action={resolveAction}>
          <input type="hidden" name="bonusId" value={bonusId} />
          <input type="hidden" name="contractorUserId" value={contractorUserId} />
          <input type="hidden" name="status" value="earned" />
          <button
            type="submit"
            disabled={resolving}
            className="border-fg-4/20 text-asaulia-green hover:bg-bg-2 rounded-md border px-2 py-0.5 text-xs disabled:opacity-60"
          >
            {t('markEarned')}
          </button>
        </form>
        <form action={resolveAction}>
          <input type="hidden" name="bonusId" value={bonusId} />
          <input type="hidden" name="contractorUserId" value={contractorUserId} />
          <input type="hidden" name="status" value="forfeited" />
          <button
            type="submit"
            disabled={resolving}
            className="border-fg-4/20 text-asaulia-red hover:bg-bg-2 rounded-md border px-2 py-0.5 text-xs disabled:opacity-60"
          >
            {t('markForfeited')}
          </button>
        </form>
      </div>
    );
  }

  if (status === 'earned') {
    return (
      <form action={payAction} className="flex">
        <input type="hidden" name="bonusId" value={bonusId} />
        <input type="hidden" name="contractorUserId" value={contractorUserId} />
        <button
          type="submit"
          disabled={paying}
          className="border-fg-4/20 text-fg-2 hover:bg-bg-2 rounded-md border px-2 py-0.5 text-xs disabled:opacity-60"
        >
          {t('markPaid')}
        </button>
      </form>
    );
  }

  return <span className="text-fg-3 text-xs">—</span>;
}
