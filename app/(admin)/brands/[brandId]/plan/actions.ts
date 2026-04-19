'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { and, eq, isNull } from 'drizzle-orm';
import { requireRole } from '@/lib/auth/rbac';
import { db, schema } from '@/lib/db';
import { PRICING } from '@/lib/pricing/constants';

export type PlanOverrideState = { error?: string; info?: string } | undefined;

const inputSchema = z.object({
  brandId: z.string().uuid(),
  fixedAmountCents: z.coerce.number().int().min(PRICING.MIN_FIXED_CENTS).max(PRICING.MAX_FIXED_CENTS),
  variablePercentBps: z.coerce
    .number()
    .int()
    .min(PRICING.MIN_VARIABLE_BPS)
    .max(PRICING.MAX_VARIABLE_BPS),
  effectiveFrom: z.string().min(1),
  reason: z.string().min(8).max(500),
});

export async function overridePlanAction(
  _prev: PlanOverrideState,
  formData: FormData,
): Promise<PlanOverrideState> {
  const actor = await requireRole(['admin']);

  const parsed = inputSchema.safeParse({
    brandId: formData.get('brandId'),
    fixedAmountCents: formData.get('fixedAmountCents'),
    variablePercentBps: formData.get('variablePercentBps'),
    effectiveFrom: formData.get('effectiveFrom'),
    reason: formData.get('reason'),
  });
  if (!parsed.success) {
    return { error: 'Check inputs: fixed/variable out of range or reason too short.' };
  }

  const effectiveFrom = new Date(parsed.data.effectiveFrom);
  if (Number.isNaN(effectiveFrom.getTime())) {
    return { error: 'Invalid effective date.' };
  }

  await db.transaction(async (tx) => {
    const [previous] = await tx
      .select()
      .from(schema.plans)
      .where(and(eq(schema.plans.brandId, parsed.data.brandId), isNull(schema.plans.effectiveTo)))
      .limit(1);

    if (previous) {
      await tx
        .update(schema.plans)
        .set({ effectiveTo: effectiveFrom })
        .where(eq(schema.plans.id, previous.id));
    }

    await tx.insert(schema.plans).values({
      brandId: parsed.data.brandId,
      fixedAmountCents: parsed.data.fixedAmountCents,
      variablePercentBps: parsed.data.variablePercentBps,
      effectiveFrom,
    });

    await tx.insert(schema.auditLog).values({
      actorUserId: actor.userId,
      brandId: parsed.data.brandId,
      action: 'plan.override',
      entityType: 'plan',
      entityId: null,
      before: previous
        ? {
            fixedAmountCents: previous.fixedAmountCents,
            variablePercentBps: previous.variablePercentBps,
          }
        : null,
      after: {
        fixedAmountCents: parsed.data.fixedAmountCents,
        variablePercentBps: parsed.data.variablePercentBps,
        effectiveFrom: parsed.data.effectiveFrom,
        reason: parsed.data.reason,
      },
    });
  });

  revalidatePath(`/admin/brands/${parsed.data.brandId}/plan`);
  return { info: 'Plan override scheduled.' };
}
