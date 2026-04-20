import Link from 'next/link';
import { desc, eq, sql } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';
import { db, schema } from '@/lib/db';
import { startImpersonationAction } from '@/app/actions/impersonation';
import { InviteContractorForm } from './invite-form';

type SearchParams = Promise<{ status?: string; onboarding?: string; q?: string }>;

export async function generateMetadata() {
  const t = await getTranslations('admin.contractors');
  return { title: t('metadata') };
}

export default async function AdminContractorsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const t = await getTranslations('admin.contractors');
  const tInvite = await getTranslations('admin.contractorInvite');
  const tStatus = await getTranslations('statuses.contractor');

  const rows = await db
    .select({
      userId: schema.users.id,
      email: schema.users.email,
      fullName: schema.users.fullName,
      status: schema.contractorProfiles.status,
      onboardingComplete: schema.contractorProfiles.payoutOnboardingComplete,
      headline: schema.contractorProfiles.headline,
      skills: schema.contractorProfiles.skills,
      createdAt: schema.contractorProfiles.createdAt,
      activeAssignments: sql<number>`(
        select count(*)::int
        from ${schema.brandContractors} bc
        where bc.contractor_user_id = ${schema.users.id} and bc.ended_at is null
      )`,
    })
    .from(schema.users)
    .innerJoin(
      schema.contractorProfiles,
      eq(schema.contractorProfiles.userId, schema.users.id),
    )
    .orderBy(desc(schema.contractorProfiles.createdAt));

  const filtered = rows.filter((r) => {
    if (sp.status && r.status !== sp.status) return false;
    if (sp.onboarding === 'incomplete' && r.onboardingComplete) return false;
    if (sp.onboarding === 'complete' && !r.onboardingComplete) return false;
    if (sp.q) {
      const term = sp.q.toLowerCase();
      const hay = [r.email, r.fullName ?? '', r.headline ?? '', ...(r.skills ?? [])]
        .join(' ')
        .toLowerCase();
      if (!hay.includes(term)) return false;
    }
    return true;
  });

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <header>
        <p className="text-fg-3 text-xs uppercase tracking-[0.12em]">{t('peopleLabel')}</p>
        <h1 className="text-fg-1 font-serif text-3xl italic">{t('contractorsTitle')}</h1>
      </header>

      <section className="border-fg-4/15 bg-bg-1 rounded-2xl border p-5">
        <h2 className="text-fg-1 mb-1 font-serif text-lg italic">{tInvite('title')}</h2>
        <p className="text-fg-3 mb-3 text-xs">{tInvite('description')}</p>
        <InviteContractorForm />
      </section>

      <form method="get" className="flex flex-wrap gap-3 text-xs">
        <input
          name="q"
          defaultValue={sp.q ?? ''}
          placeholder={t('emailNameSkill')}
          className="border-fg-4/20 bg-bg-2 text-fg-1 rounded-md border px-3 py-1.5"
        />
        <select
          name="status"
          defaultValue={sp.status ?? ''}
          className="border-fg-4/20 bg-bg-2 text-fg-1 rounded-md border px-2 py-1.5"
        >
          <option value="">{t('anyStatus')}</option>
          <option value="pending">{t('pending')}</option>
          <option value="active">{t('active')}</option>
          <option value="paused">{t('paused')}</option>
        </select>
        <select
          name="onboarding"
          defaultValue={sp.onboarding ?? ''}
          className="border-fg-4/20 bg-bg-2 text-fg-1 rounded-md border px-2 py-1.5"
        >
          <option value="">{t('anyOnboarding')}</option>
          <option value="complete">{t('payoutsReady')}</option>
          <option value="incomplete">{t('setupIncomplete')}</option>
        </select>
        <button
          type="submit"
          className="bg-asaulia-blue text-fg-on-blue rounded-md px-3 py-1.5"
        >
          {t('filter')}
        </button>
      </form>

      <section className="border-fg-4/15 bg-bg-1 overflow-x-auto rounded-2xl border">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-fg-4/10 text-fg-3 border-b text-xs uppercase tracking-[0.12em]">
              <th className="px-4 py-2 text-left">{t('contractor')}</th>
              <th className="px-4 py-2 text-left">{t('status')}</th>
              <th className="px-4 py-2 text-left">{t('payouts')}</th>
              <th className="px-4 py-2 text-right">{t('activeBrands')}</th>
              <th className="px-4 py-2 text-left">{t('skills')}</th>
              <th className="px-4 py-2 text-right">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td className="text-fg-3 px-4 py-4" colSpan={6}>
                  {t('noContractors')}
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.userId} className="border-fg-4/10 hover:bg-bg-2 border-b last:border-b-0">
                  <td className="px-4 py-2">
                    <Link
                      href={`/admin/contractors/${r.userId}`}
                      className="text-fg-1 font-medium"
                    >
                      {r.fullName ?? r.email}
                    </Link>
                    <div className="text-fg-3 text-xs">{r.headline ?? r.email}</div>
                  </td>
                  <td className="px-4 py-2 text-xs">
                    <span className="bg-bg-2 text-fg-2 rounded-full px-2 py-0.5">
                      {tStatus(r.status as 'active' | 'paused')}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs">
                    <span
                      className={`rounded-full px-2 py-0.5 ${
                        r.onboardingComplete
                          ? 'bg-asaulia-green/15 text-asaulia-green'
                          : 'bg-warning/15 text-warning'
                      }`}
                    >
                      {r.onboardingComplete ? t('ready') : t('incomplete')}
                    </span>
                  </td>
                  <td className="text-fg-1 px-4 py-2 text-right">{r.activeAssignments}</td>
                  <td className="text-fg-3 px-4 py-2 text-xs">
                    {(r.skills ?? []).slice(0, 3).join(', ')}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <form action={startImpersonationAction}>
                      <input type="hidden" name="targetUserId" value={r.userId} />
                      <button
                        type="submit"
                        className="border-fg-4/20 text-fg-2 hover:bg-bg-2 rounded-md border px-2 py-1 text-xs"
                      >
                        {t('impersonate')}
                      </button>
                    </form>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
