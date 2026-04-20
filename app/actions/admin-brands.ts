'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/rbac';
import { db, schema } from '@/lib/db';
import { currencyForRegion, type FinanceRegion } from '@/lib/billing/region';
import { inviteUserByEmail } from '@/lib/auth/invite';

const SlugSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9-]*$/);

const CreateBrandSchema = z.object({
  name: z.string().min(1).max(200),
  slug: SlugSchema,
  ownerEmail: z.string().email(),
  ownerFullName: z.string().trim().min(1).max(120).optional(),
  financeRegion: z.enum(['us', 'co']),
  timezone: z.string().min(1).max(64).optional(),
  fixedAmountCents: z.coerce.number().int().min(0).max(10_000_000_000),
  variablePercentBps: z.coerce.number().int().min(0).max(10_000),
  billingCycleDay: z.coerce.number().int().min(1).max(28),
});

export type AdminBrandErrorCode =
  | 'invalid_input'
  | 'owner_role_conflict'
  | 'invite_failed'
  | 'slug_taken'
  | 'generic';
export type AdminBrandInfoCode = 'created' | 'created_and_invited';
export type AdminBrandActionResult =
  | { ok: true; info: AdminBrandInfoCode; brandId: string }
  | { ok: false; error: AdminBrandErrorCode };

export async function adminCreateManualBrandAction(
  _prev: AdminBrandActionResult | undefined,
  formData: FormData,
): Promise<AdminBrandActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = CreateBrandSchema.safeParse({
      name: String(formData.get('name') ?? ''),
      slug: String(formData.get('slug') ?? '').toLowerCase(),
      ownerEmail: String(formData.get('ownerEmail') ?? '').toLowerCase(),
      ownerFullName: formData.get('ownerFullName')
        ? String(formData.get('ownerFullName'))
        : undefined,
      financeRegion: String(formData.get('financeRegion') ?? 'co'),
      timezone: String(formData.get('timezone') ?? '') || undefined,
      fixedAmountCents: String(formData.get('fixedAmountCents') ?? ''),
      variablePercentBps: String(formData.get('variablePercentBps') ?? ''),
      billingCycleDay: String(formData.get('billingCycleDay') ?? ''),
    });
    if (!parsed.success) return { ok: false, error: 'invalid_input' };

    const region = parsed.data.financeRegion as FinanceRegion;
    const currency = currencyForRegion(region);

    const [existing] = await db
      .select({ id: schema.brands.id })
      .from(schema.brands)
      .where(eq(schema.brands.slug, parsed.data.slug))
      .limit(1);
    if (existing) return { ok: false, error: 'slug_taken' };

    const invite = await inviteUserByEmail({
      kind: 'client',
      email: parsed.data.ownerEmail,
      fullName: parsed.data.ownerFullName ?? null,
      invitedByUserId: admin.userId,
    });
    if (!invite.ok) {
      if (invite.error === 'role_conflict') return { ok: false, error: 'owner_role_conflict' };
      return { ok: false, error: 'invite_failed' };
    }
    const ownerId = invite.userId;

    const [inserted] = await db
      .insert(schema.brands)
      .values({
        slug: parsed.data.slug,
        name: parsed.data.name,
        ownerUserId: ownerId,
        status: 'active',
        timezone: parsed.data.timezone ?? 'UTC',
        billingCycleDay: parsed.data.billingCycleDay,
        financeRegion: region,
        paymentMethod: 'manual',
        currency,
      })
      .returning({ id: schema.brands.id });

    if (!inserted) return { ok: false, error: 'generic' };

    await db
      .insert(schema.brandMembers)
      .values({
        brandId: inserted.id,
        userId: ownerId,
        role: 'owner',
        acceptedAt: new Date(),
      })
      .onConflictDoNothing();

    await db
      .update(schema.plans)
      .set({ effectiveTo: new Date() })
      .where(
        and(eq(schema.plans.brandId, inserted.id), isNull(schema.plans.effectiveTo)),
      );

    await db.insert(schema.plans).values({
      brandId: inserted.id,
      fixedAmountCents: parsed.data.fixedAmountCents,
      variablePercentBps: parsed.data.variablePercentBps,
      effectiveFrom: new Date(),
      createdByUserId: admin.userId,
      reason: 'manual_brand_created_by_admin',
    });

    await db.insert(schema.auditLog).values({
      actorUserId: admin.userId,
      action: 'admin.brand.created_manual',
      entityType: 'brand',
      entityId: inserted.id,
      after: {
        slug: parsed.data.slug,
        financeRegion: region,
        currency,
        ownerEmail: parsed.data.ownerEmail,
        ownerInvited: !invite.reused,
      },
    });

    revalidatePath('/admin/brands');
    return {
      ok: true,
      info: invite.reused ? 'created' : 'created_and_invited',
      brandId: inserted.id,
    };
  } catch {
    return { ok: false, error: 'generic' };
  }
}
