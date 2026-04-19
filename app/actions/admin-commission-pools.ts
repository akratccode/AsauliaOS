'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, isNull, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/rbac';
import { db, schema } from '@/lib/db';

const UuidSchema = z.string().uuid();
const CurrencySchema = z.enum(['USD', 'COP']);
const ScopeSchema = z.enum(['monthly', 'quarterly', 'per_project']);
const BpsSchema = z.coerce.number().int().min(0).max(10000);
const AmountCentsSchema = z.coerce.number().int().min(0);

const SetPoolSchema = z
  .object({
    brandId: UuidSchema,
    currency: CurrencySchema,
    scope: ScopeSchema,
    poolBps: z.string().trim().optional(),
    poolAmountCents: z.string().trim().optional(),
    note: z.string().trim().max(500).optional().or(z.literal('')),
  })
  .transform((raw) => {
    const bpsRaw = raw.poolBps && raw.poolBps !== '' ? raw.poolBps : undefined;
    const amountRaw =
      raw.poolAmountCents && raw.poolAmountCents !== '' ? raw.poolAmountCents : undefined;
    return {
      brandId: raw.brandId,
      currency: raw.currency,
      scope: raw.scope,
      poolBps: bpsRaw !== undefined ? BpsSchema.parse(bpsRaw) : null,
      poolAmountCents: amountRaw !== undefined ? AmountCentsSchema.parse(amountRaw) : null,
      note: raw.note && raw.note !== '' ? raw.note : null,
    };
  });

const UpsertAllocationSchema = z.object({
  brandId: UuidSchema,
  contractorUserId: UuidSchema,
  currency: CurrencySchema,
  allocationBps: BpsSchema,
});

const EndAllocationSchema = z.object({
  allocationId: UuidSchema,
  brandId: UuidSchema,
});

export type AdminCommissionPoolErrorCode =
  | 'invalid_input'
  | 'brand_not_found'
  | 'contractor_not_found'
  | 'pool_not_found'
  | 'allocation_not_found'
  | 'currency_mismatch'
  | 'exceeds_100_percent'
  | 'contractor_not_assigned'
  | 'generic';
export type AdminCommissionPoolInfoCode = 'pool_saved' | 'allocation_saved' | 'allocation_ended';
export type AdminCommissionPoolActionResult =
  | { ok: true; info: AdminCommissionPoolInfoCode }
  | { ok: false; error: AdminCommissionPoolErrorCode };

export async function adminSetBrandCommissionPoolAction(
  _prev: AdminCommissionPoolActionResult | undefined,
  formData: FormData,
): Promise<AdminCommissionPoolActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = SetPoolSchema.safeParse({
      brandId: String(formData.get('brandId') ?? ''),
      currency: String(formData.get('currency') ?? ''),
      scope: String(formData.get('scope') ?? ''),
      poolBps: formData.get('poolBps') !== null ? String(formData.get('poolBps')) : undefined,
      poolAmountCents:
        formData.get('poolAmountCents') !== null
          ? String(formData.get('poolAmountCents'))
          : undefined,
      note: formData.get('note') !== null ? String(formData.get('note')) : undefined,
    });
    if (!parsed.success) return { ok: false, error: 'invalid_input' };
    const { brandId, currency, scope, poolBps, poolAmountCents, note } = parsed.data;
    if (poolBps === null && poolAmountCents === null) {
      return { ok: false, error: 'invalid_input' };
    }

    const [brand] = await db
      .select({ id: schema.brands.id })
      .from(schema.brands)
      .where(eq(schema.brands.id, brandId))
      .limit(1);
    if (!brand) return { ok: false, error: 'brand_not_found' };

    const [existing] = await db
      .select({
        id: schema.brandCommissionPools.id,
        currency: schema.brandCommissionPools.currency,
        poolBps: schema.brandCommissionPools.poolBps,
        poolAmountCents: schema.brandCommissionPools.poolAmountCents,
        scope: schema.brandCommissionPools.scope,
        note: schema.brandCommissionPools.note,
      })
      .from(schema.brandCommissionPools)
      .where(eq(schema.brandCommissionPools.brandId, brandId))
      .limit(1);

    const now = new Date();
    let poolId: string | null = null;
    if (existing) {
      if (existing.currency !== currency) {
        const [activeCount] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(schema.brandContractorAllocations)
          .where(
            and(
              eq(schema.brandContractorAllocations.brandId, brandId),
              isNull(schema.brandContractorAllocations.endedAt),
            ),
          );
        if ((activeCount?.count ?? 0) > 0) {
          return { ok: false, error: 'currency_mismatch' };
        }
      }
      await db
        .update(schema.brandCommissionPools)
        .set({ currency, scope, poolBps, poolAmountCents, note, updatedAt: now })
        .where(eq(schema.brandCommissionPools.id, existing.id));
      poolId = existing.id;
    } else {
      const [inserted] = await db
        .insert(schema.brandCommissionPools)
        .values({
          brandId,
          currency,
          scope,
          poolBps,
          poolAmountCents,
          note,
          createdByUserId: admin.userId,
        })
        .returning({ id: schema.brandCommissionPools.id });
      poolId = inserted?.id ?? null;
    }

    await db.insert(schema.auditLog).values({
      actorUserId: admin.userId,
      brandId,
      action: 'admin.commission_pool.saved',
      entityType: 'brand_commission_pool',
      entityId: poolId,
      before: existing
        ? {
            currency: existing.currency,
            poolBps: existing.poolBps,
            poolAmountCents: existing.poolAmountCents,
            scope: existing.scope,
            note: existing.note,
          }
        : null,
      after: { currency, scope, poolBps, poolAmountCents, note },
    });

    revalidatePath(`/admin/brands/${brandId}/commission-pool`);
    return { ok: true, info: 'pool_saved' };
  } catch {
    return { ok: false, error: 'generic' };
  }
}

export async function adminUpsertBrandContractorAllocationAction(
  _prev: AdminCommissionPoolActionResult | undefined,
  formData: FormData,
): Promise<AdminCommissionPoolActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = UpsertAllocationSchema.safeParse({
      brandId: String(formData.get('brandId') ?? ''),
      contractorUserId: String(formData.get('contractorUserId') ?? ''),
      currency: String(formData.get('currency') ?? ''),
      allocationBps: String(formData.get('allocationBps') ?? ''),
    });
    if (!parsed.success) return { ok: false, error: 'invalid_input' };
    const { brandId, contractorUserId, currency, allocationBps } = parsed.data;

    const [brand] = await db
      .select({ id: schema.brands.id })
      .from(schema.brands)
      .where(eq(schema.brands.id, brandId))
      .limit(1);
    if (!brand) return { ok: false, error: 'brand_not_found' };

    const [pool] = await db
      .select({
        id: schema.brandCommissionPools.id,
        currency: schema.brandCommissionPools.currency,
      })
      .from(schema.brandCommissionPools)
      .where(eq(schema.brandCommissionPools.brandId, brandId))
      .limit(1);
    if (!pool) return { ok: false, error: 'pool_not_found' };
    if (pool.currency !== currency) return { ok: false, error: 'currency_mismatch' };

    const [contractor] = await db
      .select({ id: schema.users.id, role: schema.users.globalRole })
      .from(schema.users)
      .where(eq(schema.users.id, contractorUserId))
      .limit(1);
    if (!contractor || contractor.role !== 'contractor') {
      return { ok: false, error: 'contractor_not_found' };
    }

    const [assignment] = await db
      .select({ id: schema.brandContractors.id })
      .from(schema.brandContractors)
      .where(
        and(
          eq(schema.brandContractors.brandId, brandId),
          eq(schema.brandContractors.contractorUserId, contractorUserId),
          isNull(schema.brandContractors.endedAt),
        ),
      )
      .limit(1);
    if (!assignment) return { ok: false, error: 'contractor_not_assigned' };

    const [existingAllocation] = await db
      .select({
        id: schema.brandContractorAllocations.id,
        allocationBps: schema.brandContractorAllocations.allocationBps,
      })
      .from(schema.brandContractorAllocations)
      .where(
        and(
          eq(schema.brandContractorAllocations.brandId, brandId),
          eq(schema.brandContractorAllocations.contractorUserId, contractorUserId),
          eq(schema.brandContractorAllocations.currency, currency),
          isNull(schema.brandContractorAllocations.endedAt),
        ),
      )
      .limit(1);

    const [sumRow] = await db
      .select({ sum: sql<number>`coalesce(sum(allocation_bps), 0)::int` })
      .from(schema.brandContractorAllocations)
      .where(
        and(
          eq(schema.brandContractorAllocations.brandId, brandId),
          eq(schema.brandContractorAllocations.currency, currency),
          isNull(schema.brandContractorAllocations.endedAt),
          existingAllocation
            ? ne(schema.brandContractorAllocations.id, existingAllocation.id)
            : undefined,
        ),
      );
    const otherSum = sumRow?.sum ?? 0;
    if (otherSum + allocationBps > 10000) {
      return { ok: false, error: 'exceeds_100_percent' };
    }

    const now = new Date();
    let allocationId: string | null = null;
    if (existingAllocation) {
      await db
        .update(schema.brandContractorAllocations)
        .set({ allocationBps, updatedAt: now })
        .where(eq(schema.brandContractorAllocations.id, existingAllocation.id));
      allocationId = existingAllocation.id;
    } else {
      const [inserted] = await db
        .insert(schema.brandContractorAllocations)
        .values({
          brandId,
          contractorUserId,
          currency,
          allocationBps,
          startedAt: now,
          createdByUserId: admin.userId,
        })
        .returning({ id: schema.brandContractorAllocations.id });
      allocationId = inserted?.id ?? null;
    }

    await db.insert(schema.auditLog).values({
      actorUserId: admin.userId,
      brandId,
      action: 'admin.commission_pool.allocation_saved',
      entityType: 'brand_contractor_allocation',
      entityId: allocationId,
      before: existingAllocation ? { allocationBps: existingAllocation.allocationBps } : null,
      after: { contractorUserId, currency, allocationBps },
    });

    revalidatePath(`/admin/brands/${brandId}/commission-pool`);
    return { ok: true, info: 'allocation_saved' };
  } catch {
    return { ok: false, error: 'generic' };
  }
}

export async function adminEndBrandContractorAllocationAction(
  _prev: AdminCommissionPoolActionResult | undefined,
  formData: FormData,
): Promise<AdminCommissionPoolActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = EndAllocationSchema.safeParse({
      allocationId: String(formData.get('allocationId') ?? ''),
      brandId: String(formData.get('brandId') ?? ''),
    });
    if (!parsed.success) return { ok: false, error: 'invalid_input' };

    const [existing] = await db
      .select({
        id: schema.brandContractorAllocations.id,
        endedAt: schema.brandContractorAllocations.endedAt,
      })
      .from(schema.brandContractorAllocations)
      .where(eq(schema.brandContractorAllocations.id, parsed.data.allocationId))
      .limit(1);
    if (!existing) return { ok: false, error: 'allocation_not_found' };

    const now = new Date();
    if (existing.endedAt === null) {
      await db
        .update(schema.brandContractorAllocations)
        .set({ endedAt: now, updatedAt: now })
        .where(eq(schema.brandContractorAllocations.id, existing.id));
    }

    await db.insert(schema.auditLog).values({
      actorUserId: admin.userId,
      brandId: parsed.data.brandId,
      action: 'admin.commission_pool.allocation_ended',
      entityType: 'brand_contractor_allocation',
      entityId: existing.id,
    });

    revalidatePath(`/admin/brands/${parsed.data.brandId}/commission-pool`);
    return { ok: true, info: 'allocation_ended' };
  } catch {
    return { ok: false, error: 'generic' };
  }
}
