import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
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

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <header>
        <p className="text-fg-3 text-xs uppercase tracking-[0.12em]">Welcome</p>
        <h1 className="text-fg-1 font-serif text-3xl italic">Set up your contractor account</h1>
        <p className="text-fg-3 mt-2 text-sm">
          Two quick steps so we can assign you work and pay you on time.
        </p>
      </header>

      <Step number={1} title="Profile basics" done={Boolean(profile?.headline)}>
        <ProfileForm
          defaultHeadline={profile?.headline ?? ''}
          defaultSkills={(profile?.skills ?? []).join(', ')}
          defaultTimezone={user?.timezone ?? 'UTC'}
        />
      </Step>

      <Step number={2} title="Payout setup" done={connect.chargesEnabled && connect.payoutsEnabled}>
        {!isStripeConfigured() ? (
          <p className="text-fg-3 text-sm">
            Stripe is not configured in this environment. Contact the Asaulia team — we&apos;ll add your
            account manually.
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-fg-2 text-sm">
              We use Stripe Connect Express. You&apos;ll give Stripe the bank details directly — we never
              see them. Takes ~2 minutes.
            </p>
            <ConnectStatusRow label="Details submitted" ok={connect.detailsSubmitted} />
            <ConnectStatusRow label="Charges enabled" ok={connect.chargesEnabled} />
            <ConnectStatusRow label="Payouts enabled" ok={connect.payoutsEnabled} />
            <div className="flex flex-wrap gap-3 pt-1">
              <StartConnectButton />
              {connect.accountId && !connect.onboardingComplete && <RefreshConnectButton />}
            </div>
            {sp.refresh && (
              <p className="text-warning text-xs">
                Stripe asked for a refresh. Restart the link above to continue.
              </p>
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

function ConnectStatusRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-fg-3">{label}</span>
      <span
        className={`rounded-full px-2 py-0.5 ${
          ok ? 'bg-asaulia-green/15 text-asaulia-green' : 'bg-bg-2 text-fg-3'
        }`}
      >
        {ok ? 'ready' : 'pending'}
      </span>
    </div>
  );
}
