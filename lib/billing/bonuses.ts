import 'server-only';
import { and, eq, gte, inArray, lte } from 'drizzle-orm';
import { db, schema } from '@/lib/db';

export type BonusEvaluation = {
  bonusId: string;
  status: 'earned' | 'forfeited';
  reason: string;
};

function completed(status: string): boolean {
  return status === 'done';
}

export async function evaluatePendingBonusesForContractor(params: {
  contractorUserId: string;
  periodStart: string;
  periodEnd: string;
}): Promise<BonusEvaluation[]> {
  const pending = await db
    .select()
    .from(schema.contractorBonuses)
    .where(
      and(
        eq(schema.contractorBonuses.contractorUserId, params.contractorUserId),
        eq(schema.contractorBonuses.status, 'pending'),
        lte(schema.contractorBonuses.periodStart, params.periodEnd),
        gte(schema.contractorBonuses.periodEnd, params.periodStart),
      ),
    );

  if (pending.length === 0) return [];

  const brandIds = Array.from(
    new Set(pending.map((b) => b.brandId).filter((b): b is string => Boolean(b))),
  );

  const deliverables =
    brandIds.length === 0
      ? []
      : await db
          .select({
            brandId: schema.deliverables.brandId,
            status: schema.deliverables.status,
            periodStart: schema.deliverables.periodStart,
            periodEnd: schema.deliverables.periodEnd,
            assigneeUserId: schema.deliverables.assigneeUserId,
          })
          .from(schema.deliverables)
          .where(
            and(
              inArray(schema.deliverables.brandId, brandIds),
              eq(schema.deliverables.assigneeUserId, params.contractorUserId),
            ),
          );

  const evaluations: BonusEvaluation[] = [];
  for (const bonus of pending) {
    const relevant = deliverables.filter(
      (d) =>
        d.brandId === bonus.brandId &&
        d.periodStart >= bonus.periodStart &&
        d.periodEnd <= bonus.periodEnd,
    );

    if (bonus.conditionType === 'manual') continue;

    if (bonus.conditionType === 'all_deliverables_done') {
      if (relevant.length === 0) {
        evaluations.push({ bonusId: bonus.id, status: 'forfeited', reason: 'no deliverables' });
        continue;
      }
      const allDone = relevant.every((d) => completed(d.status));
      const doneCount = relevant.filter((d) => completed(d.status)).length;
      evaluations.push({
        bonusId: bonus.id,
        status: allDone ? 'earned' : 'forfeited',
        reason: `${doneCount}/${relevant.length} done`,
      });
      continue;
    }

    if (bonus.conditionType === 'min_deliverables_done') {
      const min = bonus.conditionMinCount ?? 0;
      const doneCount = relevant.filter((d) => completed(d.status)).length;
      evaluations.push({
        bonusId: bonus.id,
        status: doneCount >= min ? 'earned' : 'forfeited',
        reason: `${doneCount}/${min} done`,
      });
    }
  }

  for (const evalRow of evaluations) {
    await db
      .update(schema.contractorBonuses)
      .set({
        status: evalRow.status,
        resolvedAt: new Date(),
        note: evalRow.reason,
        updatedAt: new Date(),
      })
      .where(eq(schema.contractorBonuses.id, evalRow.bonusId));
  }

  return evaluations;
}

export async function resolveBonusManually(params: {
  bonusId: string;
  status: 'earned' | 'forfeited';
  note?: string;
}): Promise<void> {
  await db
    .update(schema.contractorBonuses)
    .set({
      status: params.status,
      resolvedAt: new Date(),
      note: params.note ?? null,
      updatedAt: new Date(),
    })
    .where(eq(schema.contractorBonuses.id, params.bonusId));
}

export async function markBonusesAsPaid(params: { bonusIds: string[] }): Promise<void> {
  if (params.bonusIds.length === 0) return;
  await db
    .update(schema.contractorBonuses)
    .set({ status: 'paid', updatedAt: new Date() })
    .where(inArray(schema.contractorBonuses.id, params.bonusIds));
}
