import 'server-only';
import { and, eq, lte } from 'drizzle-orm';
import { db, schema } from '@/lib/db';

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly';

export function addInterval(
  date: Date,
  frequency: RecurrenceFrequency,
  count: number,
): Date {
  const d = new Date(date);
  if (frequency === 'daily') d.setUTCDate(d.getUTCDate() + count);
  if (frequency === 'weekly') d.setUTCDate(d.getUTCDate() + 7 * count);
  if (frequency === 'monthly') d.setUTCMonth(d.getUTCMonth() + count);
  return d;
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function computePeriod(
  runOn: string,
  frequency: RecurrenceFrequency,
  count: number,
): { periodStart: string; periodEnd: string; dueDate: string } {
  const start = new Date(`${runOn}T00:00:00.000Z`);
  const end = addInterval(start, frequency, count);
  end.setUTCDate(end.getUTCDate() - 1);
  return {
    periodStart: toDateStr(start),
    periodEnd: toDateStr(end),
    dueDate: toDateStr(end),
  };
}

export async function materializeDueRecurrences(params: {
  now: Date;
  limit?: number;
}): Promise<{ created: number; advanced: number }> {
  const limit = params.limit ?? 200;
  const today = toDateStr(params.now);

  const due = await db
    .select()
    .from(schema.deliverableRecurrences)
    .where(
      and(
        eq(schema.deliverableRecurrences.active, true),
        lte(schema.deliverableRecurrences.nextRunOn, today),
      ),
    )
    .limit(limit);

  let created = 0;
  let advanced = 0;

  for (const rec of due) {
    const period = computePeriod(rec.nextRunOn, rec.frequency, rec.intervalCount);
    await db.insert(schema.deliverables).values({
      brandId: rec.brandId,
      title: rec.title,
      description: rec.description,
      type: rec.type,
      assigneeUserId: rec.assigneeUserId,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      dueDate: period.dueDate,
      fixedShareBps: rec.fixedShareBps,
      createdByUserId: rec.createdByUserId,
    });
    created += 1;

    const nextRun = addInterval(
      new Date(`${rec.nextRunOn}T00:00:00.000Z`),
      rec.frequency,
      rec.intervalCount,
    );
    await db
      .update(schema.deliverableRecurrences)
      .set({
        lastRunOn: rec.nextRunOn,
        nextRunOn: toDateStr(nextRun),
        updatedAt: new Date(),
      })
      .where(eq(schema.deliverableRecurrences.id, rec.id));
    advanced += 1;
  }

  return { created, advanced };
}
