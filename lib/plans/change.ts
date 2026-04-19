import 'server-only';
import { desc, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { PRICING, PlanInputSchema } from '@/lib/pricing';

export class PlanChangeCooldownError extends Error {
  code = 'plan_change_cooldown' as const;
  availableOn: Date;
  constructor(availableOn: Date) {
    super(`Plan change is on cooldown until ${availableOn.toISOString()}`);
    this.availableOn = availableOn;
  }
}

export class PlanChangeValidationError extends Error {
  code = 'plan_change_invalid' as const;
  constructor(message: string) {
    super(message);
  }
}

export type ChangePlanInput = {
  brandId: string;
  userId: string;
  fixedAmountCents: number;
  variablePercentBps: number;
  effectiveFrom: Date;
  reason?: string;
  now?: Date;
};

export async function changePlan(input: ChangePlanInput) {
  const parsed = PlanInputSchema.safeParse({
    fixedAmountCents: input.fixedAmountCents,
    variablePercentBps: input.variablePercentBps,
  });
  if (!parsed.success) {
    throw new PlanChangeValidationError(parsed.error.issues[0]?.message ?? 'Invalid plan');
  }

  const now = input.now ?? new Date();

  const [latest] = await db
    .select()
    .from(schema.plans)
    .where(eq(schema.plans.brandId, input.brandId))
    .orderBy(desc(schema.plans.createdAt))
    .limit(1);

  if (latest) {
    const cooldownMs = PRICING.PLAN_CHANGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
    const ageMs = now.getTime() - latest.createdAt.getTime();
    if (ageMs < cooldownMs) {
      const availableOn = new Date(latest.createdAt.getTime() + cooldownMs);
      throw new PlanChangeCooldownError(availableOn);
    }
    if (
      latest.fixedAmountCents === input.fixedAmountCents &&
      latest.variablePercentBps === input.variablePercentBps
    ) {
      throw new PlanChangeValidationError('Plan unchanged from current values');
    }
  }

  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(schema.plans)
      .values({
        brandId: input.brandId,
        fixedAmountCents: input.fixedAmountCents,
        variablePercentBps: input.variablePercentBps,
        effectiveFrom: input.effectiveFrom,
        createdByUserId: input.userId,
        reason: input.reason ?? 'plan change',
      })
      .returning();

    const row = inserted[0];
    if (!row) throw new Error('changePlan: insert returned no rows');

    await tx.insert(schema.auditLog).values({
      actorUserId: input.userId,
      brandId: input.brandId,
      action: 'plan.scheduled',
      entityType: 'plan',
      entityId: row.id,
      after: {
        fixedAmountCents: row.fixedAmountCents,
        variablePercentBps: row.variablePercentBps,
        effectiveFrom: row.effectiveFrom,
      },
    });

    return row;
  });
}

export async function listPlanHistory(brandId: string) {
  return db
    .select()
    .from(schema.plans)
    .where(eq(schema.plans.brandId, brandId))
    .orderBy(desc(schema.plans.effectiveFrom));
}

export async function currentAndUpcomingPlan(brandId: string, now: Date = new Date()) {
  const rows = await db
    .select()
    .from(schema.plans)
    .where(eq(schema.plans.brandId, brandId))
    .orderBy(desc(schema.plans.effectiveFrom));
  const current =
    rows.find((r) => r.effectiveFrom <= now && (r.effectiveTo === null || r.effectiveTo > now)) ??
    null;
  const upcoming = rows.find((r) => r.effectiveFrom > now) ?? null;
  return { current, upcoming };
}

export function planChangeAvailableOn(latestCreatedAt: Date | null): Date | null {
  if (!latestCreatedAt) return null;
  return new Date(
    latestCreatedAt.getTime() + PRICING.PLAN_CHANGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000,
  );
}
