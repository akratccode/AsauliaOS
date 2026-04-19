import { and, desc, eq, isNull } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { db, schema } from '@/lib/db';
import { formatCents, formatDate } from '@/lib/format';
import { startImpersonationAction } from '@/app/actions/impersonation';
import { ContractorBonusForm } from './bonus-form';
import { BonusRowActions } from './bonus-row-actions';
import { EvaluateBonusesForm } from './evaluate-form';

type Params = Promise<{ userId: string }>;

export default async function AdminContractorDetailPage({ params }: { params: Params }) {
  const { userId } = await params;
  const t = await getTranslations('admin.contractors');

  const [userRow, profileRow, assignments, payouts, deliverables, bonusRows] = await Promise.all([
    db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        fullName: schema.users.fullName,
        timezone: schema.users.timezone,
      })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1),
    db
      .select()
      .from(schema.contractorProfiles)
      .where(eq(schema.contractorProfiles.userId, userId))
      .limit(1),
    db
      .select({
        id: schema.brandContractors.id,
        brandId: schema.brands.id,
        brandName: schema.brands.name,
        role: schema.brandContractors.role,
        startedAt: schema.brandContractors.startedAt,
        endedAt: schema.brandContractors.endedAt,
      })
      .from(schema.brandContractors)
      .innerJoin(schema.brands, eq(schema.brands.id, schema.brandContractors.brandId))
      .where(eq(schema.brandContractors.contractorUserId, userId))
      .orderBy(desc(schema.brandContractors.startedAt)),
    db
      .select({
        id: schema.payouts.id,
        periodStart: schema.payouts.periodStart,
        periodEnd: schema.payouts.periodEnd,
        amountCents: schema.payouts.amountCents,
        status: schema.payouts.status,
      })
      .from(schema.payouts)
      .where(eq(schema.payouts.contractorUserId, userId))
      .orderBy(desc(schema.payouts.periodStart))
      .limit(24),
    db
      .select({
        id: schema.deliverables.id,
        title: schema.deliverables.title,
        brandName: schema.brands.name,
        status: schema.deliverables.status,
        completedAt: schema.deliverables.completedAt,
        dueDate: schema.deliverables.dueDate,
      })
      .from(schema.deliverables)
      .innerJoin(schema.brands, eq(schema.brands.id, schema.deliverables.brandId))
      .where(
        and(
          eq(schema.deliverables.assigneeUserId, userId),
          isNull(schema.deliverables.archivedAt),
        ),
      )
      .orderBy(desc(schema.deliverables.createdAt))
      .limit(50),
    db
      .select({
        id: schema.contractorBonuses.id,
        brandId: schema.contractorBonuses.brandId,
        brandName: schema.brands.name,
        periodStart: schema.contractorBonuses.periodStart,
        periodEnd: schema.contractorBonuses.periodEnd,
        amountCents: schema.contractorBonuses.amountCents,
        conditionType: schema.contractorBonuses.conditionType,
        conditionMinCount: schema.contractorBonuses.conditionMinCount,
        status: schema.contractorBonuses.status,
        note: schema.contractorBonuses.note,
        createdAt: schema.contractorBonuses.createdAt,
      })
      .from(schema.contractorBonuses)
      .leftJoin(schema.brands, eq(schema.brands.id, schema.contractorBonuses.brandId))
      .where(eq(schema.contractorBonuses.contractorUserId, userId))
      .orderBy(desc(schema.contractorBonuses.createdAt))
      .limit(50),
  ]);

  const user = userRow[0];
  if (!user) notFound();
  const profile = profileRow[0];

  const completed = deliverables.filter((d) => d.status === 'done').length;
  const rejected = deliverables.filter((d) => d.status === 'rejected').length;
  const rejectionRate = deliverables.length > 0 ? Math.round((rejected / deliverables.length) * 100) : 0;

  const activeBrands = assignments
    .filter((a) => !a.endedAt)
    .map((a) => ({ id: a.brandId, name: a.brandName }));

  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const toDateStr = (d: Date) => d.toISOString().slice(0, 10);
  const tBonus = await getTranslations('admin.bonuses');

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-fg-3 text-xs uppercase tracking-[0.12em]">{t('contractor')}</p>
          <h1 className="text-fg-1 font-serif text-3xl italic">{user.fullName ?? user.email}</h1>
          <p className="text-fg-3 mt-1 text-xs">
            {user.email} · {user.timezone}
            {profile?.headline ? ` · ${profile.headline}` : ''}
          </p>
        </div>
        <form action={startImpersonationAction}>
          <input type="hidden" name="targetUserId" value={user.id} />
          <button
            type="submit"
            className="border-fg-4/20 text-fg-2 hover:bg-bg-2 rounded-md border px-3 py-1.5 text-xs"
          >
            {t('impersonate')}
          </button>
        </form>
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        <Card label="Status" value={profile?.status ?? '—'} />
        <Card
          label="Payouts"
          value={profile?.payoutOnboardingComplete ? 'ready' : 'incomplete'}
        />
        <Card
          label="Deliverables"
          value={String(deliverables.length)}
          hint={`${completed} done · ${rejected} rejected (${rejectionRate}%)`}
        />
        <Card label="Active assignments" value={String(assignments.filter((a) => !a.endedAt).length)} />
      </section>

      <section className="border-fg-4/15 bg-bg-1 rounded-2xl border p-5">
        <h2 className="text-fg-1 mb-3 font-serif text-lg italic">Assignments</h2>
        {assignments.length === 0 ? (
          <p className="text-fg-3 text-sm">No brand assignments.</p>
        ) : (
          <ul className="divide-fg-4/10 divide-y">
            {assignments.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <Link
                    href={`/admin/brands/${a.brandId}`}
                    className="text-fg-1 font-medium hover:underline"
                  >
                    {a.brandName}
                  </Link>
                  <div className="text-fg-3 text-xs">
                    {a.role} · from {formatDate(a.startedAt)}
                    {a.endedAt ? ` until ${formatDate(a.endedAt)}` : ''}
                  </div>
                </div>
                {!a.endedAt && (
                  <span className="bg-asaulia-green/15 text-asaulia-green rounded-full px-2 py-0.5 text-xs">
                    active
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border-fg-4/15 bg-bg-1 rounded-2xl border p-5">
        <h2 className="text-fg-1 mb-3 font-serif text-lg italic">Payouts history</h2>
        {payouts.length === 0 ? (
          <p className="text-fg-3 text-sm">No payouts yet.</p>
        ) : (
          <ul className="divide-fg-4/10 divide-y">
            {payouts.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2 text-xs">
                <span className="text-fg-2">
                  {formatDate(p.periodStart)} – {formatDate(p.periodEnd)}
                </span>
                <span className="text-fg-3">{p.status}</span>
                <span className="text-fg-1 font-medium">{formatCents(p.amountCents)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border-fg-4/15 bg-bg-1 rounded-2xl border p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-fg-1 font-serif text-lg italic">{tBonus('title')}</h2>
          <EvaluateBonusesForm
            contractorUserId={userId}
            defaultPeriodStart={toDateStr(firstOfMonth)}
            defaultPeriodEnd={toDateStr(lastOfMonth)}
          />
        </div>
        <div className="mb-4">
          <ContractorBonusForm
            contractorUserId={userId}
            brands={activeBrands}
            defaultPeriodStart={toDateStr(firstOfMonth)}
            defaultPeriodEnd={toDateStr(lastOfMonth)}
          />
        </div>
        {bonusRows.length === 0 ? (
          <p className="text-fg-3 text-sm">{tBonus('empty')}</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="text-fg-3 uppercase tracking-[0.1em]">
              <tr>
                <th className="px-2 py-2 text-left">{tBonus('colPeriod')}</th>
                <th className="px-2 py-2 text-left">{tBonus('colBrand')}</th>
                <th className="px-2 py-2 text-left">{tBonus('colCondition')}</th>
                <th className="px-2 py-2 text-right">{tBonus('colAmount')}</th>
                <th className="px-2 py-2 text-left">{tBonus('colStatus')}</th>
                <th className="px-2 py-2 text-left">{tBonus('colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {bonusRows.map((b) => (
                <tr key={b.id} className="border-fg-4/10 border-t">
                  <td className="text-fg-2 px-2 py-2">
                    {formatDate(b.periodStart)} – {formatDate(b.periodEnd)}
                  </td>
                  <td className="text-fg-2 px-2 py-2">{b.brandName ?? '—'}</td>
                  <td className="text-fg-3 px-2 py-2">
                    {b.conditionType === 'min_deliverables_done'
                      ? `${tBonus(`condition.${b.conditionType}`)} (${b.conditionMinCount ?? 0})`
                      : tBonus(`condition.${b.conditionType}` as 'condition.manual' | 'condition.all_deliverables_done' | 'condition.min_deliverables_done')}
                    {b.note ? <div className="text-fg-4">{b.note}</div> : null}
                  </td>
                  <td className="text-fg-1 px-2 py-2 text-right">{formatCents(b.amountCents)}</td>
                  <td className="px-2 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 ${
                        b.status === 'earned'
                          ? 'bg-asaulia-green/15 text-asaulia-green'
                          : b.status === 'forfeited'
                            ? 'bg-asaulia-red/15 text-asaulia-red'
                            : b.status === 'paid'
                              ? 'bg-bg-2 text-fg-2'
                              : 'bg-warning/15 text-warning'
                      }`}
                    >
                      {tBonus(`status.${b.status}` as 'status.pending' | 'status.earned' | 'status.forfeited' | 'status.paid')}
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    <BonusRowActions
                      bonusId={b.id}
                      contractorUserId={userId}
                      status={b.status}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="border-fg-4/15 bg-bg-1 rounded-2xl border p-5">
        <h2 className="text-fg-1 mb-3 font-serif text-lg italic">Recent deliverables</h2>
        {deliverables.length === 0 ? (
          <p className="text-fg-3 text-sm">No deliverables.</p>
        ) : (
          <ul className="divide-fg-4/10 divide-y">
            {deliverables.slice(0, 12).map((d) => (
              <li key={d.id} className="flex items-center justify-between py-2 text-xs">
                <div>
                  <div className="text-fg-1">{d.title}</div>
                  <div className="text-fg-3">{d.brandName}</div>
                </div>
                <span className="text-fg-2">{d.status.replace('_', ' ')}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="border-fg-4/15 bg-bg-1 rounded-2xl border p-5">
      <p className="text-fg-3 text-xs uppercase tracking-[0.12em]">{label}</p>
      <p className="text-fg-1 mt-1 font-serif text-xl italic">{value}</p>
      {hint && <p className="text-fg-3 mt-1 text-xs">{hint}</p>}
    </div>
  );
}
