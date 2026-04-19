'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/rbac';
import { db, schema as dbSchema } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { resolveActiveBrand, requireClientBrandAccess } from '@/lib/brand/context';
import { nextBillingCycleStart } from '@/lib/brand/billing-period';
import {
  PlanChangeCooldownError,
  PlanChangeValidationError,
  changePlan,
} from '@/lib/plans/change';

export type PlanErrorCode =
  | 'no_active_brand'
  | 'only_owner_can_change'
  | 'select_valid_plan'
  | 'plan_change_cooldown'
  | 'plan_change_validation';

export type PlanActionState =
  | { ok: false; error: PlanErrorCode; availableOn?: string; detail?: string }
  | { ok: true; effectiveFrom: string }
  | undefined;

const inputSchema = z.object({
  fixedAmountCents: z.coerce.number().int(),
  variablePercentBps: z.coerce.number().int(),
});

export async function changePlanAction(
  _prev: PlanActionState,
  formData: FormData,
): Promise<PlanActionState> {
  const actor = await requireAuth();
  const { active } = await resolveActiveBrand(actor);
  if (!active) return { ok: false, error: 'no_active_brand' };
  const { role } = await requireClientBrandAccess(actor, active.id);
  if (role !== 'owner' && actor.globalRole !== 'admin' && actor.globalRole !== 'operator') {
    return { ok: false, error: 'only_owner_can_change' };
  }

  const parsed = inputSchema.safeParse({
    fixedAmountCents: formData.get('fixedAmountCents'),
    variablePercentBps: formData.get('variablePercentBps'),
  });
  if (!parsed.success) return { ok: false, error: 'select_valid_plan' };

  const brandRow = await db
    .select({ billingCycleDay: dbSchema.brands.billingCycleDay })
    .from(dbSchema.brands)
    .where(eq(dbSchema.brands.id, active.id))
    .limit(1);
  const effectiveFrom = nextBillingCycleStart(brandRow[0]?.billingCycleDay ?? null);

  try {
    const row = await changePlan({
      brandId: active.id,
      userId: actor.userId,
      fixedAmountCents: parsed.data.fixedAmountCents,
      variablePercentBps: parsed.data.variablePercentBps,
      effectiveFrom,
      reason: 'self-serve plan change',
    });
    revalidatePath('/plan');
    revalidatePath('/billing');
    revalidatePath('/dashboard');
    return { ok: true, effectiveFrom: row.effectiveFrom.toISOString() };
  } catch (err) {
    if (err instanceof PlanChangeCooldownError) {
      return {
        ok: false,
        error: 'plan_change_cooldown',
        availableOn: err.availableOn.toISOString(),
      };
    }
    if (err instanceof PlanChangeValidationError) {
      return {
        ok: false,
        error: 'plan_change_validation',
        detail: err.message,
      };
    }
    throw err;
  }
}
