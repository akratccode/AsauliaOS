'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth/rbac';
import { db, schema } from '@/lib/db';

const TypeEnum = z.enum([
  'content_post',
  'ad_creative',
  'landing_page',
  'seo_article',
  'email_sequence',
  'strategy_doc',
  'custom',
]);

const FrequencyEnum = z.enum(['daily', 'weekly', 'monthly']);
const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const CreateSchema = z.object({
  brandId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  type: TypeEnum,
  assigneeUserId: z.string().uuid().optional(),
  frequency: FrequencyEnum,
  intervalCount: z
    .string()
    .regex(/^\d+$/)
    .transform((v) => Number(v))
    .refine((n) => n >= 1 && n <= 365, { message: 'interval_range' }),
  nextRunOn: DateSchema,
  fixedShareBps: z
    .string()
    .regex(/^\d+$/)
    .transform((v) => Number(v))
    .optional(),
});

export type AdminRecurrenceErrorCode = 'invalid_input' | 'forbidden' | 'generic';
export type AdminRecurrenceInfoCode = 'created' | 'toggled' | 'deleted';
export type AdminRecurrenceActionResult =
  | { ok: true; info: AdminRecurrenceInfoCode }
  | { ok: false; error: AdminRecurrenceErrorCode };

function optionalString(v: FormDataEntryValue | null): string | undefined {
  if (v === null) return undefined;
  const s = String(v).trim();
  return s.length === 0 ? undefined : s;
}

export async function adminCreateRecurrenceAction(
  _prev: AdminRecurrenceActionResult | undefined,
  formData: FormData,
): Promise<AdminRecurrenceActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = CreateSchema.safeParse({
      brandId: String(formData.get('brandId') ?? ''),
      title: String(formData.get('title') ?? ''),
      description: optionalString(formData.get('description')),
      type: String(formData.get('type') ?? ''),
      assigneeUserId: optionalString(formData.get('assigneeUserId')),
      frequency: String(formData.get('frequency') ?? ''),
      intervalCount: String(formData.get('intervalCount') ?? '1'),
      nextRunOn: String(formData.get('nextRunOn') ?? ''),
      fixedShareBps: optionalString(formData.get('fixedShareBps')),
    });
    if (!parsed.success) return { ok: false, error: 'invalid_input' };

    await db.insert(schema.deliverableRecurrences).values({
      brandId: parsed.data.brandId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      type: parsed.data.type,
      assigneeUserId: parsed.data.assigneeUserId ?? null,
      frequency: parsed.data.frequency,
      intervalCount: parsed.data.intervalCount,
      nextRunOn: parsed.data.nextRunOn,
      fixedShareBps: parsed.data.fixedShareBps ?? 0,
      createdByUserId: admin.userId,
    });

    revalidatePath(`/admin/brands/${parsed.data.brandId}/recurrences`);
    return { ok: true, info: 'created' };
  } catch {
    return { ok: false, error: 'generic' };
  }
}

const ToggleSchema = z.object({
  recurrenceId: z.string().uuid(),
  active: z.enum(['true', 'false']).transform((v) => v === 'true'),
  brandId: z.string().uuid(),
});

export async function adminToggleRecurrenceAction(
  _prev: AdminRecurrenceActionResult | undefined,
  formData: FormData,
): Promise<AdminRecurrenceActionResult> {
  try {
    await requireAdmin();
    const parsed = ToggleSchema.safeParse({
      recurrenceId: String(formData.get('recurrenceId') ?? ''),
      active: String(formData.get('active') ?? ''),
      brandId: String(formData.get('brandId') ?? ''),
    });
    if (!parsed.success) return { ok: false, error: 'invalid_input' };

    await db
      .update(schema.deliverableRecurrences)
      .set({ active: parsed.data.active, updatedAt: new Date() })
      .where(eq(schema.deliverableRecurrences.id, parsed.data.recurrenceId));

    revalidatePath(`/admin/brands/${parsed.data.brandId}/recurrences`);
    return { ok: true, info: 'toggled' };
  } catch {
    return { ok: false, error: 'generic' };
  }
}

const DeleteSchema = z.object({
  recurrenceId: z.string().uuid(),
  brandId: z.string().uuid(),
});

export async function adminDeleteRecurrenceAction(
  _prev: AdminRecurrenceActionResult | undefined,
  formData: FormData,
): Promise<AdminRecurrenceActionResult> {
  try {
    await requireAdmin();
    const parsed = DeleteSchema.safeParse({
      recurrenceId: String(formData.get('recurrenceId') ?? ''),
      brandId: String(formData.get('brandId') ?? ''),
    });
    if (!parsed.success) return { ok: false, error: 'invalid_input' };

    await db
      .delete(schema.deliverableRecurrences)
      .where(eq(schema.deliverableRecurrences.id, parsed.data.recurrenceId));

    revalidatePath(`/admin/brands/${parsed.data.brandId}/recurrences`);
    return { ok: true, info: 'deleted' };
  } catch {
    return { ok: false, error: 'generic' };
  }
}
