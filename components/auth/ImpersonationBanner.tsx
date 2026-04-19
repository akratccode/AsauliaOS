import { getTranslations } from 'next-intl/server';
import { readImpersonationCookie } from '@/lib/auth/impersonation';
import { stopImpersonationAction } from '@/app/actions/impersonation';

export async function ImpersonationBanner() {
  const impersonation = await readImpersonationCookie();
  if (!impersonation) return null;
  const t = await getTranslations('admin.impersonation');
  return (
    <div className="bg-warning/20 text-fg-1 flex flex-wrap items-center justify-between gap-2 border-b border-warning/40 px-6 py-2 text-xs">
      <span>
        {t('bannerActive')}{' '}
        <span className="font-mono">{impersonation.targetUserId.slice(0, 8)}</span>
      </span>
      <form action={stopImpersonationAction}>
        <button
          type="submit"
          className="bg-warning text-fg-on-blue rounded-md px-3 py-1 text-xs font-medium"
        >
          {t('stop')}
        </button>
      </form>
    </div>
  );
}
