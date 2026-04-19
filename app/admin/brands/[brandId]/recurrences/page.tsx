import { and, desc, eq, isNull } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';
import { db, schema } from '@/lib/db';
import { formatDate } from '@/lib/format';
import { RecurrenceForm } from './recurrence-form';
import { RecurrenceRowActions } from './recurrence-row-actions';

type Params = Promise<{ brandId: string }>;

export default async function AdminBrandRecurrencesPage({ params }: { params: Params }) {
  const { brandId } = await params;
  const t = await getTranslations('admin.recurrences');

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

  const rows = await db
    .select({
      id: schema.deliverableRecurrences.id,
      title: schema.deliverableRecurrences.title,
      type: schema.deliverableRecurrences.type,
      frequency: schema.deliverableRecurrences.frequency,
      intervalCount: schema.deliverableRecurrences.intervalCount,
      nextRunOn: schema.deliverableRecurrences.nextRunOn,
      lastRunOn: schema.deliverableRecurrences.lastRunOn,
      active: schema.deliverableRecurrences.active,
      assigneeUserId: schema.deliverableRecurrences.assigneeUserId,
    })
    .from(schema.deliverableRecurrences)
    .where(eq(schema.deliverableRecurrences.brandId, brandId))
    .orderBy(desc(schema.deliverableRecurrences.createdAt));

  const assigneeLabel = (id: string | null) => {
    if (!id) return t('unassigned');
    return contractors.find((c) => c.userId === id)?.label ?? id.slice(0, 8);
  };

  const today = new Date();
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const toDateStr = (d: Date) => d.toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <section className="border-fg-4/15 bg-bg-1 rounded-2xl border p-4">
        <h2 className="text-fg-1 mb-3 font-serif text-lg italic">{t('newTitle')}</h2>
        <RecurrenceForm
          brandId={brandId}
          contractors={contractors}
          defaultNextRunOn={toDateStr(tomorrow)}
        />
      </section>

      <section className="border-fg-4/15 bg-bg-1 overflow-x-auto rounded-2xl border">
        <table className="w-full min-w-[720px] text-xs">
          <thead className="text-fg-3 uppercase tracking-[0.1em]">
            <tr>
              <th className="px-3 py-2 text-left">{t('colTitle')}</th>
              <th className="px-3 py-2 text-left">{t('colFrequency')}</th>
              <th className="px-3 py-2 text-left">{t('colAssignee')}</th>
              <th className="px-3 py-2 text-left">{t('colNextRun')}</th>
              <th className="px-3 py-2 text-left">{t('colActive')}</th>
              <th className="px-3 py-2 text-right">{t('colActions')}</th>
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
              rows.map((r) => (
                <tr key={r.id} className="border-fg-4/10 border-t">
                  <td className="text-fg-1 px-3 py-2">{r.title}</td>
                  <td className="text-fg-2 px-3 py-2">
                    {t(`frequency${r.frequency.charAt(0).toUpperCase()}${r.frequency.slice(1)}` as 'frequencyDaily' | 'frequencyWeekly' | 'frequencyMonthly')}
                    {r.intervalCount > 1 ? ` × ${r.intervalCount}` : ''}
                  </td>
                  <td className="text-fg-2 px-3 py-2">{assigneeLabel(r.assigneeUserId)}</td>
                  <td className="text-fg-2 px-3 py-2">{formatDate(r.nextRunOn)}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 ${
                        r.active
                          ? 'bg-asaulia-green/15 text-asaulia-green'
                          : 'bg-bg-2 text-fg-3'
                      }`}
                    >
                      {r.active ? t('active') : t('paused')}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <RecurrenceRowActions
                      brandId={brandId}
                      recurrenceId={r.id}
                      active={r.active}
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
