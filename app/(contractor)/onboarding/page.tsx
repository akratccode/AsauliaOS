import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { requireAuth } from '@/lib/auth/rbac';
import { db, schema } from '@/lib/db';
import {
  readConnectState,
  refreshOnboardingComplete,
} from '@/lib/contractor/stripe-connect';
import { isStripeConfigured } from '@/lib/billing/stripe';
import { ProfileForm } from '../profile/ProfileForm';
import { StartConnectButton, RefreshConnectButton } from './ConnectButton';

type SearchParams = Promise<{ return?: string; refresh?: string }>;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('contractor.onboarding');
  return { title: t('metadata') };
}

export default async function ContractorOnboardingPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const actor = await requireAuth();
  const sp = await searchParams;

  if (sp.return) {
    await refreshOnboardingComplete(actor.userId);
  }

  const [user] = await db
    .select({ timezone: schema.users.timezone })
    .from(schema.users)
    .where(eq(schema.users.id, actor.userId))
    .limit(1);
  const [profile] = await db
    .select({
      headline: schema.contractorProfiles.headline,
      skills: schema.contractorProfiles.skills,
      onboardingComplete: schema.contractorProfiles.payoutOnboardingComplete,
    })
    .from(schema.contractorProfiles)
    .where(eq(schema.contractorProfiles.userId, actor.userId))
    .limit(1);

  if (profile?.onboardingComplete) {
    redirect('/tasks');
  }

  const connect = await readConnectState(actor.userId);

  const t = await getTranslations('contractor.onboarding');
  const tProfile = await getTranslations('contractor.profile');

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <header>
        <p className="text-fg-3 text-xs uppercase tracking-[0.12em]">{t('welcomeLabel')}</p>
        <h1 className="text-fg-1 font-serif text-3xl italic">{t('onboardingTitle')}</h1>
        <p className="text-fg-3 mt-2 text-sm">{t('twoSteps')}</p>
      </header>

      <Step number={1} title={t('profileBasics')} done={Boolean(profile?.headline)}>
        <ProfileForm
          defaultHeadline={profile?.headline ?? ''}
          defaultSkills={(profile?.skills ?? []).join(', ')}
          defaultTimezone={user?.timezone ?? 'UTC'}
        />
      </Step>

      <Step number={2} title={t('payoutSetup')} done={connect.chargesEnabled && connect.payoutsEnabled}>
        {!isStripeConfigured() ? (
          <p className="text-fg-3 text-sm">{t('stripeNotConfigured')}</p>
        ) : (
          <div className="space-y-3">
            <p className="text-fg-2 text-sm">{t('stripeExpress')}</p>
            <ConnectStatusRow
              label={tProfile('detailsSubmitted')}
              ok={connect.detailsSubmitted}
              readyLabel={tProfile('ready')}
              pendingLabel={t('pending')}
            />
            <ConnectStatusRow
              label={tProfile('chargesEnabled')}
              ok={connect.chargesEnabled}
              readyLabel={tProfile('ready')}
              pendingLabel={t('pending')}
            />
            <ConnectStatusRow
              label={tProfile('payoutsEnabled')}
              ok={connect.payoutsEnabled}
              readyLabel={tProfile('ready')}
              pendingLabel={t('pending')}
            />
            <div className="flex flex-wrap gap-3 pt-1">
              <StartConnectButton />
              {connect.accountId && !connect.onboardingComplete && <RefreshConnectButton />}
            </div>
            {sp.refresh && (
              <p className="text-warning text-xs">{t('stripeRefresh')}</p>
            )}
          </div>
        )}
      </Step>
    </main>
  );
}

function Step({
  number,
  title,
  done,
  children,
}: {
  number: number;
  title: string;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="border-fg-4/15 bg-bg-1 space-y-4 rounded-2xl border p-6">
      <div className="flex items-center gap-3">
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
            done
              ? 'bg-asaulia-green/20 text-asaulia-green'
              : 'bg-asaulia-blue/20 text-fg-1'
          }`}
          aria-hidden
        >
          {done ? '✓' : number}
        </span>
        <h2 className="text-fg-1 font-serif text-xl italic">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function ConnectStatusRow({
  label,
  ok,
  readyLabel,
  pendingLabel,
}: {
  label: string;
  ok: boolean;
  readyLabel: string;
  pendingLabel: string;
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-fg-3">{label}</span>
      <span
        className={`rounded-full px-2 py-0.5 ${
          ok ? 'bg-asaulia-green/15 text-asaulia-green' : 'bg-bg-2 text-fg-3'
        }`}
      >
        {ok ? readyLabel : pendingLabel}
      </span>
    </div>
  );
}
