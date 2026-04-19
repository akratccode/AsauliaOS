import { and, desc, eq, isNull } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { db, schema } from '@/lib/db';
import { formatCents, formatDate } from '@/lib/format';

type Params = Promise<{ userId: string }>;

export default async function AdminContractorDetailPage({ params }: { params: Params }) {
  const { userId } = await params;

  const [user] = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      fullName: schema.users.fullName,
      timezone: schema.users.timezone,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  if (!user) notFound();

  const [profile] = await db
    .select()
    .from(schema.contractorProfiles)
    .where(eq(schema.contractorProfiles.userId, userId))
    .limit(1);

  const assignments = await db
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
    .orderBy(desc(schema.brandContractors.startedAt));

  const payouts = await db
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
    .limit(24);

  const deliverables = await db
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
    .limit(50);

  const completed = deliverables.filter((d) => d.status === 'done').length;
  const rejected = deliverables.filter((d) => d.status === 'rejected').length;
  const rejectionRate = deliverables.length > 0 ? Math.round((rejected / deliverables.length) * 100) : 0;

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-6">
      <header>
        <p className="text-fg-3 text-xs uppercase tracking-[0.12em]">Contractor</p>
        <h1 className="text-fg-1 font-serif text-3xl italic">{user.fullName ?? user.email}</h1>
        <p className="text-fg-3 mt-1 text-xs">
          {user.email} · {user.timezone}
          {profile?.headline ? ` · ${profile.headline}` : ''}
        </p>
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
