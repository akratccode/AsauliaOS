'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth/rbac';
import { db, schema } from '@/lib/db';
import {
  evaluatePendingBonusesForContractor,
  resolveBonusManually,
} from '@/lib/billing/bonuses';

const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const UuidSchema = z.string().uuid();

const CreateSchema = z.object({
  contractorUserId: UuidSchema,
  brandId: UuidSchema.optional(),
  periodStart: DateSchema,
  periodEnd: DateSchema,
  amountCents: z
    .string()
    .regex(/^\d+$/)
    .transform((v) => Number(v))
    .refine((n) => n > 0, { message: 'amount_positive' }),
  conditionType: z.enum(['all_deliverables_done', 'min_deliverables_done', 'manual']),
  conditionMinCount: z
    .string()
    .regex(/^\d+$/)
    .transform((v) => Number(v))
    .optional(),
  note: z.string().max(500).optional(),
});

export type AdminBonusErrorCode = 'invalid_input' | 'forbidden' | 'generic';
export type AdminBonusInfoCode = 'created' | 'evaluated' | 'resolved';
export type AdminBonusActionResult =
  | { ok: true; info: AdminBonusInfoCode; count?: number }
  | { ok: false; error: AdminBonusErrorCode };

function optionalString(v: FormDataEntryValue | null): string | undefined {
  if (v === null) return undefined;
  const s = String(v).trim();
  return s.length === 0 ? undefined : s;
}

export async function adminCreateBonusAction(
  _prev: AdminBonusActionResult | undefined,
  formData: FormData,
): Promise<AdminBonusActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = CreateSchema.safeParse({
      contractorUserId: String(formData.get('contractorUserId') ?? ''),
      brandId: optionalString(formData.get('brandId')),
      periodStart: String(formData.get('periodStart') ?? ''),
      periodEnd: String(formData.get('periodEnd') ?? ''),
      amountCents: String(formData.get('amountCents') ?? ''),
      conditionType: String(formData.get('conditionType') ?? 'manual'),
      conditionMinCount: optionalString(formData.get('conditionMinCount')),
      note: optionalString(formData.get('note')),
    });
    if (!parsed.success) return { ok: false, error: 'invalid_input' };

    const [inserted] = await db
      .insert(schema.contractorBonuses)
      .values({
        contractorUserId: parsed.data.contractorUserId,
        brandId: parsed.data.brandId ?? null,
        periodStart: parsed.data.periodStart,
        periodEnd: parsed.data.periodEnd,
        amountCents: parsed.data.amountCents,
        conditionType: parsed.data.conditionType,
        conditionMinCount: parsed.data.conditionMinCount ?? null,
        note: parsed.data.note ?? null,
        createdByUserId: admin.userId,
      })
      .returning({ id: schema.contractorBonuses.id });

    await db.insert(schema.auditLog).values({
      actorUserId: admin.userId,
      action: 'bonus.created',
      entityType: 'contractor_bonus',
      entityId: inserted?.id ?? null,
      after: {
        contractorUserId: parsed.data.contractorUserId,
        amountCents: parsed.data.amountCents,
        conditionType: parsed.data.conditionType,
        periodStart: parsed.data.periodStart,
        periodEnd: parsed.data.periodEnd,
      },
    });

    revalidatePath(`/admin/contractors/${parsed.data.contractorUserId}`);
    return { ok: true, info: 'created' };
  } catch {
    return { ok: false, error: 'generic' };
  }
}

const EvaluateSchema = z.object({
  contractorUserId: UuidSchema,
  periodStart: DateSchema,
  periodEnd: DateSchema,
});

export async function adminEvaluateBonusesAction(
  _prev: AdminBonusActionResult | undefined,
  formData: FormData,
): Promise<AdminBonusActionResult> {
  try {
    await requireAdmin();
    const parsed = EvaluateSchema.safeParse({
      contractorUserId: String(formData.get('contractorUserId') ?? ''),
      periodStart: String(formData.get('periodStart') ?? ''),
      periodEnd: String(formData.get('periodEnd') ?? ''),
    });
    if (!parsed.success) return { ok: false, error: 'invalid_input' };
    const evals = await evaluatePendingBonusesForContractor(parsed.data);
    revalidatePath(`/admin/contractors/${parsed.data.contractorUserId}`);
    return { ok: true, info: 'evaluated', count: evals.length };
  } catch {
    return { ok: false, error: 'generic' };
  }
}

const ResolveSchema = z.object({
  bonusId: UuidSchema,
  status: z.enum(['earned', 'forfeited']),
  note: z.string().max(500).optional(),
  contractorUserId: UuidSchema,
});

export async function adminResolveBonusAction(
  _prev: AdminBonusActionResult | undefined,
  formData: FormData,
): Promise<AdminBonusActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = ResolveSchema.safeParse({
      bonusId: String(formData.get('bonusId') ?? ''),
      status: String(formData.get('status') ?? ''),
      note: optionalString(formData.get('note')),
      contractorUserId: String(formData.get('contractorUserId') ?? ''),
    });
    if (!parsed.success) return { ok: false, error: 'invalid_input' };

    await resolveBonusManually({
      bonusId: parsed.data.bonusId,
      status: parsed.data.status,
      note: parsed.data.note,
    });

    await db.insert(schema.auditLog).values({
      actorUserId: admin.userId,
      action: `bonus.${parsed.data.status}`,
      entityType: 'contractor_bonus',
      entityId: parsed.data.bonusId,
      after: { note: parsed.data.note ?? null },
    });

    revalidatePath(`/admin/contractors/${parsed.data.contractorUserId}`);
    return { ok: true, info: 'resolved' };
  } catch {
    return { ok: false, error: 'generic' };
  }
}

const MarkPaidSchema = z.object({
  bonusId: UuidSchema,
  contractorUserId: UuidSchema,
});

export async function adminMarkBonusPaidAction(
  _prev: AdminBonusActionResult | undefined,
  formData: FormData,
): Promise<AdminBonusActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = MarkPaidSchema.safeParse({
      bonusId: String(formData.get('bonusId') ?? ''),
      contractorUserId: String(formData.get('contractorUserId') ?? ''),
    });
    if (!parsed.success) return { ok: false, error: 'invalid_input' };

    await db
      .update(schema.contractorBonuses)
      .set({ status: 'paid', updatedAt: new Date() })
      .where(eq(schema.contractorBonuses.id, parsed.data.bonusId));

    await db.insert(schema.auditLog).values({
      actorUserId: admin.userId,
      action: 'bonus.paid',
      entityType: 'contractor_bonus',
      entityId: parsed.data.bonusId,
    });

    revalidatePath(`/admin/contractors/${parsed.data.contractorUserId}`);
    return { ok: true, info: 'resolved' };
  } catch {
    return { ok: false, error: 'generic' };
  }
}
