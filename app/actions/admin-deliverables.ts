'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/rbac';
import {
  assignDeliverable,
  createDeliverable,
  updateDeliverableContent,
} from '@/lib/deliverables/service';
import type { DeliverableType } from '@/lib/deliverables/types';

const TypeEnum = z.enum([
  'content_post',
  'ad_creative',
  'landing_page',
  'seo_article',
  'email_sequence',
  'strategy_doc',
  'custom',
]);

const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const CreateSchema = z.object({
  brandId: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  type: TypeEnum,
  periodStart: DateSchema,
  periodEnd: DateSchema,
  assigneeUserId: z.string().uuid().optional(),
  dueDate: DateSchema.optional(),
  fixedShareBps: z
    .string()
    .regex(/^\d+$/)
    .transform((v) => Number(v))
    .optional(),
});

const AssignSchema = z.object({
  deliverableId: z.string().uuid(),
  assigneeUserId: z.string().uuid().optional(),
});

export type AdminDeliverableErrorCode =
  | 'invalid_input'
  | 'unauthorized'
  | 'forbidden'
  | 'generic';
export type AdminDeliverableInfoCode = 'created' | 'assigned' | 'updated';
export type AdminDeliverableActionResult =
  | { ok: true; info: AdminDeliverableInfoCode }
  | { ok: false; error: AdminDeliverableErrorCode };

function parseOptional(value: FormDataEntryValue | null): string | undefined {
  if (value === null) return undefined;
  const s = String(value).trim();
  return s.length === 0 ? undefined : s;
}

export async function adminCreateDeliverableAction(
  _prev: AdminDeliverableActionResult | undefined,
  formData: FormData,
): Promise<AdminDeliverableActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = CreateSchema.safeParse({
      brandId: String(formData.get('brandId') ?? ''),
      title: String(formData.get('title') ?? ''),
      description: parseOptional(formData.get('description')),
      type: String(formData.get('type') ?? '') as DeliverableType,
      periodStart: String(formData.get('periodStart') ?? ''),
      periodEnd: String(formData.get('periodEnd') ?? ''),
      assigneeUserId: parseOptional(formData.get('assigneeUserId')),
      dueDate: parseOptional(formData.get('dueDate')),
      fixedShareBps: parseOptional(formData.get('fixedShareBps')),
    });
    if (!parsed.success) return { ok: false, error: 'invalid_input' };

    await createDeliverable(admin, {
      brandId: parsed.data.brandId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      type: parsed.data.type,
      periodStart: parsed.data.periodStart,
      periodEnd: parsed.data.periodEnd,
      assigneeUserId: parsed.data.assigneeUserId ?? null,
      dueDate: parsed.data.dueDate ?? null,
      fixedShareBps: parsed.data.fixedShareBps,
    });
    revalidatePath(`/admin/brands/${parsed.data.brandId}/deliverables`);
    return { ok: true, info: 'created' };
  } catch {
    return { ok: false, error: 'generic' };
  }
}

export async function adminAssignDeliverableAction(
  _prev: AdminDeliverableActionResult | undefined,
  formData: FormData,
): Promise<AdminDeliverableActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = AssignSchema.safeParse({
      deliverableId: String(formData.get('deliverableId') ?? ''),
      assigneeUserId: parseOptional(formData.get('assigneeUserId')),
    });
    if (!parsed.success) return { ok: false, error: 'invalid_input' };
    await assignDeliverable(
      admin,
      parsed.data.deliverableId,
      parsed.data.assigneeUserId ?? null,
    );
    const brandId = String(formData.get('brandId') ?? '');
    if (brandId) revalidatePath(`/admin/brands/${brandId}/deliverables`);
    return { ok: true, info: 'assigned' };
  } catch {
    return { ok: false, error: 'generic' };
  }
}

export async function adminUpdateDeliverableShareAction(
  _prev: AdminDeliverableActionResult | undefined,
  formData: FormData,
): Promise<AdminDeliverableActionResult> {
  try {
    const admin = await requireAdmin();
    const deliverableId = String(formData.get('deliverableId') ?? '');
    const shareStr = String(formData.get('fixedShareBps') ?? '').trim();
    if (!/^[0-9a-f-]{36}$/i.test(deliverableId) || !/^\d+$/.test(shareStr)) {
      return { ok: false, error: 'invalid_input' };
    }
    const fixedShareBps = Number(shareStr);
    await updateDeliverableContent(admin, deliverableId, { fixedShareBps });
    const brandId = String(formData.get('brandId') ?? '');
    if (brandId) revalidatePath(`/admin/brands/${brandId}/deliverables`);
    return { ok: true, info: 'updated' };
  } catch {
    return { ok: false, error: 'generic' };
  }
}
