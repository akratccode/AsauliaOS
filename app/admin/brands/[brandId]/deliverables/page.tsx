import Link from 'next/link';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';
import { db, schema } from '@/lib/db';
import { summarizeAllocation } from '@/lib/deliverables/allocation';
import { formatDate } from '@/lib/format';
import { DeliverablePlannerForm } from './planner-form';
import { AssigneeForm } from './assignee-form';

type Params = Promise<{ brandId: string }>;

export default async function AdminBrandDeliverablesPage({ params }: { params: Params }) {
  const { brandId } = await params;
  const t = await getTranslations('admin.deliverablePlanner');

  const rows = await db
    .select()
    .from(schema.deliverables)
    .where(and(eq(schema.deliverables.brandId, brandId), isNull(schema.deliverables.archivedAt)))
    .orderBy(desc(schema.deliverables.createdAt))
    .limit(200);

  const summary = summarizeAllocation(rows);

  const contractorRows = await db
    .select({
      userId: schema.users.id,
      email: schema.users.email,
      fullName: schema.users.fullName,
    })
    .from(schema.brandContractors)
    .innerJoin(schema.users, eq(schema.users.id, schema.brandContractors.contractorUserId))
    .where(
      and(
        eq(schema.brandContractors.brandId, brandId),
        isNull(schema.brandContractors.endedAt),
      ),
    );

  const contractors = contractorRows.map((c) => ({
    userId: c.userId,
    label: c.fullName ?? c.email,
  }));

  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const toDateStr = (d: Date) => d.toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <section
        className={`rounded-2xl border p-4 text-sm ${
          summary.flag === 'exact'
            ? 'border-asaulia-green/30 text-asaulia-green'
            : 'border-asaulia-red/30 text-asaulia-red'
        }`}
      >
        {t('allocationSummary', {
          percent: (summary.totalBps / 100).toFixed(1),
          flag: t(`flag.${summary.flag}` as 'flag.exact' | 'flag.over_allocated' | 'flag.under_allocated'),
        })}{' '}
        <Link
          href={`/deliverables?brandId=${brandId}`}
          className="text-asaulia-blue-soft underline"
        >
          {t('kanbanLink')}
        </Link>
      </section>

      <section className="border-fg-4/15 bg-bg-1 rounded-2xl border p-4">
        <h2 className="text-fg-1 mb-3 font-serif text-lg italic">{t('planTitle')}</h2>
        <DeliverablePlannerForm
          brandId={brandId}
          defaultPeriodStart={toDateStr(firstOfMonth)}
          defaultPeriodEnd={toDateStr(lastOfMonth)}
          contractors={contractors}
        />
      </section>

      <section className="border-fg-4/15 bg-bg-1 overflow-x-auto rounded-2xl border">
        <table className="w-full min-w-[720px] text-xs">
          <thead className="text-fg-3 uppercase tracking-[0.1em]">
            <tr>
              <th className="px-3 py-2 text-left">{t('colTitle')}</th>
              <th className="px-3 py-2 text-left">{t('colType')}</th>
              <th className="px-3 py-2 text-left">{t('colStatus')}</th>
              <th className="px-3 py-2 text-right">{t('colShare')}</th>
              <th className="px-3 py-2 text-right">{t('colDue')}</th>
              <th className="px-3 py-2 text-left">{t('colAssignee')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="text-fg-3 px-3 py-4" colSpan={6}>
                  {t('empty')}
                </td>
              </tr>
            ) : (
              rows.map((d) => (
                <tr key={d.id} className="border-fg-4/10 border-t">
                  <td className="text-fg-1 px-3 py-2">{d.title}</td>
                  <td className="text-fg-3 px-3 py-2 uppercase tracking-[0.1em]">{d.type}</td>
                  <td className="text-fg-2 px-3 py-2">{d.status.replace('_', ' ')}</td>
                  <td className="text-fg-2 px-3 py-2 text-right">{d.fixedShareBps}</td>
                  <td className="text-fg-3 px-3 py-2 text-right">
                    {d.dueDate ? formatDate(d.dueDate) : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <AssigneeForm
                      brandId={brandId}
                      deliverableId={d.id}
                      currentAssigneeUserId={d.assigneeUserId}
                      contractors={contractors}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
