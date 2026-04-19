'use server';

import { revalidatePath } from 'next/cache';
import { requireAuth } from '@/lib/auth/rbac';
import { db, schema } from '@/lib/db';
import {
  isTransactionalType,
  type NotificationType,
} from '@/lib/notifications/service';

const MUTABLE_TYPES: NotificationType[] = [
  'welcome',
  'invite',
  'deliverable_assigned',
  'deliverable_approved',
  'deliverable_rejected',
  'cycle_close_summary',
  'plan_change_confirmed',
  'chat_message',
];

export type PrefState = { success: true } | { error: string } | undefined;

export async function saveNotificationPreferencesAction(
  _prev: PrefState,
  formData: FormData,
): Promise<PrefState> {
  const actor = await requireAuth();

  for (const type of MUTABLE_TYPES) {
    if (isTransactionalType(type)) continue;
    for (const channel of ['email', 'inapp'] as const) {
      const enabled = formData.get(`${type}:${channel}`) === 'on';
      await db
        .insert(schema.notificationPreferences)
        .values({ userId: actor.userId, type, channel, enabled })
        .onConflictDoUpdate({
          target: [
            schema.notificationPreferences.userId,
            schema.notificationPreferences.type,
            schema.notificationPreferences.channel,
          ],
          set: { enabled, updatedAt: new Date() },
        });
    }
  }

  revalidatePath('/notifications/preferences');
  return { success: true };
}
