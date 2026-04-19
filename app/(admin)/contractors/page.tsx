import Link from 'next/link';
import { desc, eq, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';

type SearchParams = Promise<{ status?: string; onboarding?: string; q?: string }>;

export default async function AdminContractorsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;

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
        <p className="text-fg-3 text-xs uppercase tracking-[0.12em]">People</p>
        <h1 className="text-fg-1 font-serif text-3xl italic">Contractors</h1>
      </header>

      <form method="get" className="flex flex-wrap gap-3 text-xs">
        <input
          name="q"
          defaultValue={sp.q ?? ''}
          placeholder="Email, name, skill"
          className="border-fg-4/20 bg-bg-2 text-fg-1 rounded-md border px-3 py-1.5"
        />
        <select
          name="status"
          defaultValue={sp.status ?? ''}
          className="border-fg-4/20 bg-bg-2 text-fg-1 rounded-md border px-2 py-1.5"
        >
          <option value="">Any status</option>
          <option value="pending">Pending</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
        </select>
        <select
          name="onboarding"
          defaultValue={sp.onboarding ?? ''}
          className="border-fg-4/20 bg-bg-2 text-fg-1 rounded-md border px-2 py-1.5"
        >
          <option value="">Any onboarding</option>
          <option value="complete">Payouts ready</option>
          <option value="incomplete">Setup incomplete</option>
        </select>
        <button
          type="submit"
          className="bg-asaulia-blue text-fg-on-blue rounded-md px-3 py-1.5"
        >
          Filter
        </button>
      </form>

      <section className="border-fg-4/15 bg-bg-1 overflow-x-auto rounded-2xl border">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-fg-4/10 text-fg-3 border-b text-xs uppercase tracking-[0.12em]">
              <th className="px-4 py-2 text-left">Contractor</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Payouts</th>
              <th className="px-4 py-2 text-right">Active brands</th>
              <th className="px-4 py-2 text-left">Skills</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td className="text-fg-3 px-4 py-4" colSpan={5}>
                  No contractors match.
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
                    <span className="bg-bg-2 text-fg-2 rounded-full px-2 py-0.5">{r.status}</span>
                  </td>
                  <td className="px-4 py-2 text-xs">
                    <span
                      className={`rounded-full px-2 py-0.5 ${
                        r.onboardingComplete
                          ? 'bg-asaulia-green/15 text-asaulia-green'
                          : 'bg-warning/15 text-warning'
                      }`}
                    >
                      {r.onboardingComplete ? 'ready' : 'incomplete'}
                    </span>
                  </td>
                  <td className="text-fg-1 px-4 py-2 text-right">{r.activeAssignments}</td>
                  <td className="text-fg-3 px-4 py-2 text-xs">
                    {(r.skills ?? []).slice(0, 3).join(', ')}
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

