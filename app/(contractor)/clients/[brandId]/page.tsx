import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';
import { requireAuth } from '@/lib/auth/rbac';
import { db, schema } from '@/lib/db';
import { resolveBillingWindow, periodYmd } from '@/lib/brand/billing-period';
import { projectEarningsForPeriod } from '@/lib/contractor/earnings';
import { formatCents, formatDate, formatBps } from '@/lib/format';
import type { DeliverableStatus } from '@/lib/deliverables/types';

type Params = Promise<{ brandId: string }>;

const COLUMNS = [
  { status: 'todo', key: 'todo' },
  { status: 'in_progress', key: 'inProgress' },
  { status: 'in_review', key: 'inReview' },
  { status: 'done', key: 'done' },
] as const satisfies ReadonlyArray<{
  status: DeliverableStatus;
  key: 'todo' | 'inProgress' | 'inReview' | 'done' | 'rejected';
}>;

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

  const t = await getTranslations('contractor.clientWorkspace');
  const tTasks = await getTranslations('contractor.tasks');
  const tLayout = await getTranslations('dashboard.contractor');
  const tPlan = await getTranslations('client.plan');

  const planLabel = myBrand?.plan
    ? `${formatCents(myBrand.plan.fixedAmountCents)}${tPlan('perMonth')} + ${formatBps(myBrand.plan.variablePercentBps)} ${t('variable')}`
    : tPlan('noActivePlan');

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <header className="flex items-end justify-between">
        <div>
          <Link href="/clients" className="text-fg-3 hover:text-fg-1 text-xs uppercase tracking-[0.12em]">
            {t('allClients')}
          </Link>
          <h1 className="text-fg-1 mt-1 font-serif text-3xl italic">{assignment.brandName}</h1>
          <p className="text-fg-3 mt-1 text-xs">{t('roleDot')} {assignment.role}</p>
        </div>
        {/* eslint-disable-next-line i18next/no-literal-string -- separator dot between translated label and formatted period range */}
        <div className="text-fg-3 text-xs">{tLayout('periodLabel')} · {window.label}</div>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="border-fg-4/15 bg-bg-1 rounded-2xl border p-5">
          <p className="text-fg-3 text-xs uppercase tracking-[0.12em]">{t('myDeliverables')}</p>
          <p className="text-fg-1 mt-1 font-serif text-2xl italic">
            {doneCount} / {totalCount}
          </p>
          <div className="bg-bg-2 mt-3 h-1.5 overflow-hidden rounded-full">
            <div
              className="bg-asaulia-blue-soft h-full rounded-full"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-fg-3 mt-2 text-xs">{progressPct}{t('complete')}</p>
        </div>
        <div className="border-fg-4/15 bg-bg-1 rounded-2xl border p-5">
          <p className="text-fg-3 text-xs uppercase tracking-[0.12em]">{t('projectedEarnings')}</p>
          <p className="text-fg-1 mt-1 font-serif text-2xl italic">
            {formatCents(myBrand?.totalCents ?? 0)}
          </p>
          <p className="text-fg-3 mt-1 text-xs">
            {formatCents(myBrand?.myFixedShareCents ?? 0)} {t('fixedDot')}{' '}
            {formatCents(myBrand?.myVariableShareCents ?? 0)} {t('variable')}
          </p>
        </div>
        <div className="border-fg-4/15 bg-bg-1 rounded-2xl border p-5">
          <p className="text-fg-3 text-xs uppercase tracking-[0.12em]">{t('brandPlan')}</p>
          <p className="text-fg-1 mt-1 font-serif text-lg italic">{planLabel}</p>
          <p className="text-fg-3 mt-1 text-xs">
            {/* eslint-disable-next-line i18next/no-literal-string -- separator dot between translated label and formatted money value */}
            {t('aggregateAttributedSales')} · {formatCents(myBrand?.attributedSalesCents ?? 0)}
          </p>
        </div>
      </section>

      <section className="border-fg-4/15 bg-bg-1 rounded-2xl border p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-fg-1 font-serif text-lg italic">{t('myWorkOnThisBrand')}</h2>
          <span className="text-fg-3 text-xs">{t('dragInKanban')}</span>
        </div>
        {totalCount === 0 ? (
          <p className="text-fg-3 text-sm">{t('noDeliverablesAssigned')}</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-4">
            {COLUMNS.map(({ status, key }) => (
              <div key={status} className="bg-bg-2 rounded-xl p-3">
                <div className="text-fg-3 mb-2 text-[11px] uppercase tracking-[0.1em]">
                  {/* eslint-disable-next-line i18next/no-literal-string -- separator dot between translated label and numeric count */}
                  {tTasks(key)} · {grouped[status].length}
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
                          {tTasks('due', { date: formatDate(d.dueDate) })}
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
