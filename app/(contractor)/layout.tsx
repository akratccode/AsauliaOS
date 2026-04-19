import type { ReactNode } from 'react';
import { eq } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';
import { requireAuth } from '@/lib/auth/rbac';
import { db, schema } from '@/lib/db';
import { projectEarningsForPeriod } from '@/lib/contractor/earnings';
import { resolveBillingWindow } from '@/lib/brand/billing-period';
import { ContractorSidebar, ContractorBottomNav } from '@/components/contractor-shell/Sidebar';
import { formatCents } from '@/lib/format';
import { Forbidden } from '@/lib/auth/errors';

export default async function ContractorLayout({ children }: { children: ReactNode }) {
  const actor = await requireAuth();
  if (actor.globalRole !== 'contractor' && actor.globalRole !== 'admin' && actor.globalRole !== 'operator') {
    throw new Forbidden('Contractor access only');
  }

  const window = resolveBillingWindow(null);
  const projection = await projectEarningsForPeriod(actor.userId, {
    start: window.start,
    end: window.end,
  });

  const [profile] = await db
    .select({
      payoutOnboardingComplete: schema.contractorProfiles.payoutOnboardingComplete,
      stripeConnectAccountId: schema.contractorProfiles.stripeConnectAccountId,
    })
    .from(schema.contractorProfiles)
    .where(eq(schema.contractorProfiles.userId, actor.userId))
    .limit(1);

  const needsOnboarding = !profile?.payoutOnboardingComplete;

  const t = await getTranslations('dashboard.contractor');

  return (
    <div className="bg-bg-0 text-fg-1 flex min-h-dvh">
      <ContractorSidebar />
      <div className="flex w-full flex-col pb-16 md:pb-0">
        <header className="border-fg-4/10 flex items-center justify-between gap-4 border-b px-6 py-3">
          <span className="text-fg-3 text-xs">
            {/* eslint-disable-next-line i18next/no-literal-string -- separator dot between label and formatted period range */}
            {t('periodLabel')} · {window.label}
          </span>
          <div className="flex items-center gap-3">
            <span className="bg-asaulia-blue/15 text-fg-1 rounded-full px-3 py-1 text-xs">
              {/* eslint-disable-next-line i18next/no-literal-string -- separator dot between label and formatted money value */}
              {t('projectedThisPeriod')} · {formatCents(projection.totalCents)}
            </span>
            <span className="text-fg-3 hidden text-xs md:inline">{actor.email}</span>
          </div>
        </header>
        {needsOnboarding && (
          <div className="border-warning/30 bg-warning/10 text-fg-2 border-b px-6 py-2 text-xs">
            {t('completeStripeConnectSetup')}{' '}
            <a href="/onboarding" className="text-asaulia-blue-soft hover:underline">
              {t('finishSetup')}
            </a>
          </div>
        )}
        <div className="flex-1">{children}</div>
        <ContractorBottomNav />
      </div>
    </div>
  );
}
