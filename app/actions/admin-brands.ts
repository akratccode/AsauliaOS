'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/rbac';
import { db, schema } from '@/lib/db';
import { currencyForRegion, type FinanceRegion } from '@/lib/billing/region';

const SlugSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9-]*$/);

const CreateBrandSchema = z.object({
  name: z.string().min(1).max(200),
  slug: SlugSchema,
  ownerEmail: z.string().email(),
  financeRegion: z.enum(['us', 'co']),
  timezone: z.string().min(1).max(64).optional(),
  fixedAmountCents: z.coerce.number().int().min(0).max(10_000_000_000),
  variablePercentBps: z.coerce.number().int().min(0).max(10_000),
  billingCycleDay: z.coerce.number().int().min(1).max(28),
});

export type AdminBrandErrorCode =
  | 'invalid_input'
  | 'owner_not_found'
  | 'slug_taken'
  | 'generic';
export type AdminBrandInfoCode = 'created';
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
      financeRegion: String(formData.get('financeRegion') ?? 'co'),
      timezone: String(formData.get('timezone') ?? '') || undefined,
      fixedAmountCents: String(formData.get('fixedAmountCents') ?? ''),
      variablePercentBps: String(formData.get('variablePercentBps') ?? ''),
      billingCycleDay: String(formData.get('billingCycleDay') ?? ''),
    });
    if (!parsed.success) return { ok: false, error: 'invalid_input' };

    const region = parsed.data.financeRegion as FinanceRegion;
    const currency = currencyForRegion(region);

    const [owner] = await db
      .select({ id: schema.users.id, email: schema.users.email })
      .from(schema.users)
      .where(eq(schema.users.email, parsed.data.ownerEmail))
      .limit(1);
    if (!owner) return { ok: false, error: 'owner_not_found' };

    const [existing] = await db
      .select({ id: schema.brands.id })
      .from(schema.brands)
      .where(eq(schema.brands.slug, parsed.data.slug))
      .limit(1);
    if (existing) return { ok: false, error: 'slug_taken' };

    const [inserted] = await db
      .insert(schema.brands)
      .values({
        slug: parsed.data.slug,
        name: parsed.data.name,
        ownerUserId: owner.id,
        status: 'active',
        timezone: parsed.data.timezone ?? 'UTC',
        billingCycleDay: parsed.data.billingCycleDay,
        financeRegion: region,
        paymentMethod: 'manual',
        currency,
      })
      .returning({ id: schema.brands.id });

    if (!inserted) return { ok: false, error: 'generic' };

    await db.insert(schema.brandMembers).values({
      brandId: inserted.id,
      userId: owner.id,
      role: 'owner',
      acceptedAt: new Date(),
    });

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
        ownerEmail: owner.email,
      },
    });

    revalidatePath('/admin/brands');
    return { ok: true, info: 'created', brandId: inserted.id };
  } catch {
    return { ok: false, error: 'generic' };
  }
}
