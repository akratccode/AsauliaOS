import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/rbac';
import { db, schema } from '@/lib/db';
import { resolveBillingWindow, periodYmd } from '@/lib/brand/billing-period';
import { projectEarningsForPeriod } from '@/lib/contractor/earnings';
import { formatCents, formatDate, formatBps } from '@/lib/format';
import type { DeliverableStatus } from '@/lib/deliverables/types';

type Params = Promise<{ brandId: string }>;

const COLUMNS: ReadonlyArray<[DeliverableStatus, string]> = [
  ['todo', 'To do'],
  ['in_progress', 'In progress'],
  ['in_review', 'In review'],
  ['done', 'Done'],
];

export default async function ContractorBrandWorkspacePage({ params }: { params: Params }) {
  const { brandId } = await params;
  const actor = await requireAuth();

  const [assignment] = await db
    .select({
      role: schema.brandContractors.role,
      brandId: schema.brands.id,
      brandName: schema.brands.name,
      billingCycleDay: schema.brands.billingCycleDay,
    })
    .from(schema.brandContractors)
    .innerJoin(schema.brands, eq(schema.brandContractors.brandId, schema.brands.id))
    .where(
      and(
        eq(schema.brandContractors.contractorUserId, actor.userId),
        eq(schema.brandContractors.brandId, brandId),
        isNull(schema.brandContractors.endedAt),
      ),
    )
    .limit(1);

  if (!assignment) notFound();

  const window = resolveBillingWindow(assignment.billingCycleDay ?? null);
  const periodStart = periodYmd(window.start);
  const periodEnd = periodYmd(new Date(window.end.getTime() - 86_400_000));

  const deliverables = await db
    .select({
      id: schema.deliverables.id,
      title: schema.deliverables.title,
      type: schema.deliverables.type,
      status: schema.deliverables.status,
      dueDate: schema.deliverables.dueDate,
      fixedShareBps: schema.deliverables.fixedShareBps,
    })
    .from(schema.deliverables)
    .where(
      and(
        eq(schema.deliverables.brandId, brandId),
        eq(schema.deliverables.assigneeUserId, actor.userId),
        isNull(schema.deliverables.archivedAt),
        gte(schema.deliverables.periodStart, periodStart),
        lte(schema.deliverables.periodEnd, periodEnd),
      ),
    )
    .orderBy(sql`coalesce(${schema.deliverables.dueDate}, '9999-12-31') asc`);

  const projection = await projectEarningsForPeriod(actor.userId, {
    start: window.start,
    end: window.end,
  });
  const myBrand = projection.byBrand.find((b) => b.brandId === brandId);

  const doneCount = deliverables.filter((d) => d.status === 'done').length;
  const totalCount = deliverables.length;
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  const grouped: Record<DeliverableStatus, typeof deliverables> = {
    todo: [],
    in_progress: [],
    in_review: [],
    done: [],
    rejected: [],
  };
  for (const d of deliverables) grouped[d.status].push(d);

  const planLabel = myBrand?.plan
    ? `${formatCents(myBrand.plan.fixedAmountCents)}/month + ${formatBps(myBrand.plan.variablePercentBps)} variable`
    : 'No active plan';

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <header className="flex items-end justify-between">
        <div>
          <Link href="/clients" className="text-fg-3 hover:text-fg-1 text-xs uppercase tracking-[0.12em]">
            ← All clients
          </Link>
          <h1 className="text-fg-1 mt-1 font-serif text-3xl italic">{assignment.brandName}</h1>
          <p className="text-fg-3 mt-1 text-xs">Role · {assignment.role}</p>
        </div>
        <div className="text-fg-3 text-xs">Period · {window.label}</div>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="border-fg-4/15 bg-bg-1 rounded-2xl border p-5">
          <p className="text-fg-3 text-xs uppercase tracking-[0.12em]">My deliverables</p>
          <p className="text-fg-1 mt-1 font-serif text-2xl italic">
            {doneCount} / {totalCount}
          </p>
          <div className="bg-bg-2 mt-3 h-1.5 overflow-hidden rounded-full">
            <div
              className="bg-asaulia-blue-soft h-full rounded-full"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-fg-3 mt-2 text-xs">{progressPct}% complete</p>
        </div>
        <div className="border-fg-4/15 bg-bg-1 rounded-2xl border p-5">
          <p className="text-fg-3 text-xs uppercase tracking-[0.12em]">Projected earnings</p>
          <p className="text-fg-1 mt-1 font-serif text-2xl italic">
            {formatCents(myBrand?.totalCents ?? 0)}
          </p>
          <p className="text-fg-3 mt-1 text-xs">
            {formatCents(myBrand?.myFixedShareCents ?? 0)} fixed ·{' '}
            {formatCents(myBrand?.myVariableShareCents ?? 0)} variable
          </p>
        </div>
        <div className="border-fg-4/15 bg-bg-1 rounded-2xl border p-5">
          <p className="text-fg-3 text-xs uppercase tracking-[0.12em]">Brand plan</p>
          <p className="text-fg-1 mt-1 font-serif text-lg italic">{planLabel}</p>
          <p className="text-fg-3 mt-1 text-xs">
            Aggregate attributed sales · {formatCents(myBrand?.attributedSalesCents ?? 0)}
          </p>
        </div>
      </section>

      <section className="border-fg-4/15 bg-bg-1 rounded-2xl border p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-fg-1 font-serif text-lg italic">My work on this brand</h2>
          <span className="text-fg-3 text-xs">Drag in the client Kanban. Contractor view is read-only here.</span>
        </div>
        {totalCount === 0 ? (
          <p className="text-fg-3 text-sm">No deliverables assigned to you this period.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-4">
            {COLUMNS.map(([status, label]) => (
              <div key={status} className="bg-bg-2 rounded-xl p-3">
                <div className="text-fg-3 mb-2 text-[11px] uppercase tracking-[0.1em]">
                  {label} · {grouped[status].length}
                </div>
                <ul className="space-y-2">
                  {grouped[status].map((d) => (
                    <li
                      key={d.id}
                      className="border-fg-4/10 bg-bg-1 rounded-md border p-2 text-xs"
                    >
                      <div className="text-fg-1 font-medium">{d.title}</div>
                      <div className="text-fg-3 mt-0.5 text-[10px] uppercase tracking-[0.1em]">
                        {d.type}
                      </div>
                      {d.dueDate && (
                        <div className="text-fg-3 mt-1 text-[11px]">
                          due {formatDate(d.dueDate)}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
