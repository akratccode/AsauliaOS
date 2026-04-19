import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/rbac';
import { db, schema } from '@/lib/db';
import { readConnectState } from '@/lib/contractor/stripe-connect';
import { isStripeConfigured } from '@/lib/billing/stripe';
import { ProfileForm } from './ProfileForm';

export default async function ContractorProfilePage() {
  const actor = await requireAuth();

  const [user] = await db
    .select({ email: schema.users.email, timezone: schema.users.timezone })
    .from(schema.users)
    .where(eq(schema.users.id, actor.userId))
    .limit(1);
  const [profile] = await db
    .select({
      headline: schema.contractorProfiles.headline,
      skills: schema.contractorProfiles.skills,
      stripeAccountId: schema.contractorProfiles.stripeConnectAccountId,
      onboardingComplete: schema.contractorProfiles.payoutOnboardingComplete,
    })
    .from(schema.contractorProfiles)
    .where(eq(schema.contractorProfiles.userId, actor.userId))
    .limit(1);

  const connect = isStripeConfigured()
    ? await readConnectState(actor.userId)
    : {
        accountId: profile?.stripeAccountId ?? null,
        detailsSubmitted: false,
        chargesEnabled: false,
        payoutsEnabled: false,
        onboardingComplete: profile?.onboardingComplete ?? false,
      };

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <header>
        <p className="text-fg-3 text-xs uppercase tracking-[0.12em]">Account</p>
        <h1 className="text-fg-1 font-serif text-3xl italic">Profile</h1>
      </header>

      <section className="border-fg-4/15 bg-bg-1 space-y-3 rounded-2xl border p-5">
        <p className="text-fg-3 text-xs uppercase tracking-[0.12em]">Signed in as</p>
        <p className="text-fg-1 text-sm">{user?.email}</p>
      </section>

      <section className="border-fg-4/15 bg-bg-1 space-y-4 rounded-2xl border p-5">
        <h2 className="text-fg-1 font-serif text-lg italic">Details</h2>
        <ProfileForm
          defaultHeadline={profile?.headline ?? ''}
          defaultSkills={(profile?.skills ?? []).join(', ')}
          defaultTimezone={user?.timezone ?? 'UTC'}
        />
      </section>

      <section className="border-fg-4/15 bg-bg-1 space-y-3 rounded-2xl border p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-fg-1 font-serif text-lg italic">Payouts</h2>
          <span
            className={`rounded-full px-2 py-0.5 text-xs ${
              connect.chargesEnabled && connect.payoutsEnabled
                ? 'bg-asaulia-green/15 text-asaulia-green'
                : 'bg-warning/15 text-warning'
            }`}
          >
            {connect.chargesEnabled && connect.payoutsEnabled ? 'ready' : 'incomplete'}
          </span>
        </div>
        <dl className="grid grid-cols-2 gap-1 text-xs">
          <dt className="text-fg-3">Account</dt>
          <dd className="text-fg-2 text-right font-mono">{connect.accountId ?? '—'}</dd>
          <dt className="text-fg-3">Details submitted</dt>
          <dd className="text-fg-2 text-right">{connect.detailsSubmitted ? 'yes' : 'no'}</dd>
          <dt className="text-fg-3">Charges enabled</dt>
          <dd className="text-fg-2 text-right">{connect.chargesEnabled ? 'yes' : 'no'}</dd>
          <dt className="text-fg-3">Payouts enabled</dt>
          <dd className="text-fg-2 text-right">{connect.payoutsEnabled ? 'yes' : 'no'}</dd>
        </dl>
        <p className="text-fg-3 text-xs">
          Bank details live in Stripe — update them in your{' '}
          <a
            href="https://connect.stripe.com/express_login"
            target="_blank"
            rel="noreferrer"
            className="text-asaulia-blue-soft hover:underline"
          >
            Stripe Express dashboard
          </a>
          .
        </p>
        {!connect.onboardingComplete && (
          <Link
            href="/onboarding"
            className="bg-asaulia-blue text-fg-on-blue inline-block rounded-md px-4 py-2 text-sm"
          >
            Finish payout setup →
          </Link>
        )}
      </section>
    </main>
  );
}
