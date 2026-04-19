'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/rbac';
import { db, schema } from '@/lib/db';

const UuidSchema = z.string().uuid();

const AssignSchema = z.object({
  brandId: UuidSchema,
  contractorUserId: UuidSchema,
  role: z.string().trim().min(1).max(64),
});

const EndSchema = z.object({
  assignmentId: UuidSchema,
  brandId: UuidSchema,
});

export type AdminBrandContractorErrorCode =
  | 'invalid_input'
  | 'brand_not_found'
  | 'contractor_not_found'
  | 'assignment_exists'
  | 'assignment_not_found'
  | 'generic';
export type AdminBrandContractorInfoCode = 'assigned' | 'ended';
export type AdminBrandContractorActionResult =
  | { ok: true; info: AdminBrandContractorInfoCode }
  | { ok: false; error: AdminBrandContractorErrorCode };

export async function adminAssignContractorToBrandAction(
  _prev: AdminBrandContractorActionResult | undefined,
  formData: FormData,
): Promise<AdminBrandContractorActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = AssignSchema.safeParse({
      brandId: String(formData.get('brandId') ?? ''),
      contractorUserId: String(formData.get('contractorUserId') ?? ''),
      role: String(formData.get('role') ?? ''),
    });
    if (!parsed.success) return { ok: false, error: 'invalid_input' };
    const { brandId, contractorUserId, role } = parsed.data;

    const [brand] = await db
      .select({ id: schema.brands.id })
      .from(schema.brands)
      .where(eq(schema.brands.id, brandId))
      .limit(1);
    if (!brand) return { ok: false, error: 'brand_not_found' };

    const [contractor] = await db
      .select({ id: schema.users.id, role: schema.users.globalRole })
      .from(schema.users)
      .where(eq(schema.users.id, contractorUserId))
      .limit(1);
    if (!contractor || contractor.role !== 'contractor') {
      return { ok: false, error: 'contractor_not_found' };
    }

    const [existingActive] = await db
      .select({ id: schema.brandContractors.id })
      .from(schema.brandContractors)
      .where(
        and(
          eq(schema.brandContractors.brandId, brandId),
          eq(schema.brandContractors.contractorUserId, contractorUserId),
          eq(schema.brandContractors.role, role),
          isNull(schema.brandContractors.endedAt),
        ),
      )
      .limit(1);
    if (existingActive) return { ok: false, error: 'assignment_exists' };

    const now = new Date();
    const [inserted] = await db
      .insert(schema.brandContractors)
      .values({ brandId, contractorUserId, role, startedAt: now })
      .onConflictDoUpdate({
        target: [
          schema.brandContractors.brandId,
          schema.brandContractors.contractorUserId,
          schema.brandContractors.role,
        ],
        set: { startedAt: now, endedAt: null },
      })
      .returning({ id: schema.brandContractors.id });

    await db.insert(schema.auditLog).values({
      actorUserId: admin.userId,
      action: 'admin.brand_contractor.assigned',
      entityType: 'brand_contractor',
      entityId: inserted?.id ?? null,
      after: { brandId, contractorUserId, role },
    });

    revalidatePath(`/admin/brands/${brandId}/contractors`);
    revalidatePath('/admin/contractors/matrix');
    return { ok: true, info: 'assigned' };
  } catch {
    return { ok: false, error: 'generic' };
  }
}

export async function adminEndBrandAssignmentAction(
  _prev: AdminBrandContractorActionResult | undefined,
  formData: FormData,
): Promise<AdminBrandContractorActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = EndSchema.safeParse({
      assignmentId: String(formData.get('assignmentId') ?? ''),
      brandId: String(formData.get('brandId') ?? ''),
    });
    if (!parsed.success) return { ok: false, error: 'invalid_input' };

    const [existing] = await db
      .select({
        id: schema.brandContractors.id,
        endedAt: schema.brandContractors.endedAt,
      })
      .from(schema.brandContractors)
      .where(eq(schema.brandContractors.id, parsed.data.assignmentId))
      .limit(1);
    if (!existing) return { ok: false, error: 'assignment_not_found' };

    const now = new Date();
    if (existing.endedAt === null) {
      await db
        .update(schema.brandContractors)
        .set({ endedAt: now })
        .where(eq(schema.brandContractors.id, existing.id));
    }

    await db.insert(schema.auditLog).values({
      actorUserId: admin.userId,
      action: 'admin.brand_contractor.ended',
      entityType: 'brand_contractor',
      entityId: existing.id,
    });

    revalidatePath(`/admin/brands/${parsed.data.brandId}/contractors`);
    revalidatePath('/admin/contractors/matrix');
    return { ok: true, info: 'ended' };
  } catch {
    return { ok: false, error: 'generic' };
  }
}
