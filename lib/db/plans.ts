import 'server-only';
import { and, eq, isNull } from 'drizzle-orm';
import { db, schema } from '@/lib/db';

export type SavePlanInput = {
  brandId: string;
  createdByUserId: string;
  fixedAmountCents: number;
  variablePercentBps: number;
  reason?: string;
  effectiveFrom?: Date;
};

/**
 * Atomically close the currently-open plan for a brand and insert the new one.
 * Runs inside a transaction so there is never more than one open plan per brand.
 */
export async function savePlanRecord(input: SavePlanInput) {
  const effectiveFrom = input.effectiveFrom ?? new Date();

  return db.transaction(async (tx) => {
    await tx
      .update(schema.plans)
      .set({ effectiveTo: effectiveFrom })
      .where(
        and(eq(schema.plans.brandId, input.brandId), isNull(schema.plans.effectiveTo)),
      );

    const [row] = await tx
      .insert(schema.plans)
      .values({
        brandId: input.brandId,
        fixedAmountCents: input.fixedAmountCents,
        variablePercentBps: input.variablePercentBps,
        effectiveFrom,
        effectiveTo: null,
        createdByUserId: input.createdByUserId,
        reason: input.reason,
      })
      .returning();

    if (!row) throw new Error('Failed to insert plan');
    return row;
  });
}

export async function getCurrentPlan(brandId: string) {
  const [plan] = await db
    .select()
    .from(schema.plans)
    .where(and(eq(schema.plans.brandId, brandId), isNull(schema.plans.effectiveTo)))
    .limit(1);
  return plan ?? null;
}
