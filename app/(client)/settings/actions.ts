'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/rbac';
import { db, schema } from '@/lib/db';
import { resolveActiveBrand, requireClientBrandAccess } from '@/lib/brand/context';

export type SettingsErrorCode =
  | 'no_active_brand'
  | 'only_owner_can_update'
  | 'check_fields';

export type SettingsInfoCode = 'settings_saved';

export type SettingsActionState =
  | { error: SettingsErrorCode }
  | { info: SettingsInfoCode }
  | undefined;

const schema$ = z.object({
  name: z.string().min(2).max(60),
  website: z
    .string()
    .url()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  timezone: z.string().min(1),
});

export async function updateBrandSettingsAction(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const actor = await requireAuth();
  const { active } = await resolveActiveBrand(actor);
  if (!active) return { error: 'no_active_brand' };
  const { role } = await requireClientBrandAccess(actor, active.id);
  if (role !== 'owner' && actor.globalRole !== 'admin' && actor.globalRole !== 'operator') {
    return { error: 'only_owner_can_update' };
  }

  const parsed = schema$.safeParse({
    name: formData.get('name'),
    website: formData.get('website') ?? '',
    timezone: formData.get('timezone') ?? 'UTC',
  });
  if (!parsed.success) return { error: 'check_fields' };

  await db
    .update(schema.brands)
    .set({
      name: parsed.data.name,
      website: parsed.data.website ?? null,
      timezone: parsed.data.timezone,
      updatedAt: new Date(),
    })
    .where(eq(schema.brands.id, active.id));

  await db.insert(schema.auditLog).values({
    actorUserId: actor.userId,
    brandId: active.id,
    action: 'brand.updated',
    entityType: 'brand',
    entityId: active.id,
    after: parsed.data,
  });

  revalidatePath('/settings');
  return { info: 'settings_saved' };
}
