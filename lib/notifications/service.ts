import 'server-only';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { sendEmail } from './email';

/**
 * Union of notification types. Each value is both the DB `type` column and the
 * key looked up in `notification_preferences`. Keep this enum and the email
 * renderer (`lib/notifications/templates.tsx`) in sync — tests enforce it.
 */
export type NotificationType =
  | 'welcome'
  | 'invite'
  | 'deliverable_assigned'
  | 'deliverable_approved'
  | 'deliverable_rejected'
  | 'invoice_issued'
  | 'invoice_paid'
  | 'payment_failed'
  | 'cycle_close_summary'
  | 'payout_sent'
  | 'payout_failed'
  | 'plan_change_confirmed'
  | 'password_reset'
  | 'chat_message';

/**
 * Types that a user can never mute. Invoices, payouts, payment failures, and
 * password resets are legally/operationally required and must always deliver
 * on both channels — the preference check skips these.
 */
const TRANSACTIONAL_TYPES: ReadonlySet<NotificationType> = new Set([
  'invoice_issued',
  'invoice_paid',
  'payment_failed',
  'payout_sent',
  'payout_failed',
  'password_reset',
]);

export function isTransactionalType(type: NotificationType): boolean {
  return TRANSACTIONAL_TYPES.has(type);
}

export async function isChannelEnabled(
  userId: string,
  type: NotificationType,
  channel: 'email' | 'inapp',
): Promise<boolean> {
  if (isTransactionalType(type)) return true;
  const [pref] = await db
    .select({ enabled: schema.notificationPreferences.enabled })
    .from(schema.notificationPreferences)
    .where(
      and(
        eq(schema.notificationPreferences.userId, userId),
        eq(schema.notificationPreferences.type, type),
        eq(schema.notificationPreferences.channel, channel),
      ),
    )
    .limit(1);
  return pref?.enabled ?? true;
}

export async function createNotification(params: {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  linkUrl?: string;
}): Promise<{ inserted: boolean; id?: string }> {
  const allowed = await isChannelEnabled(params.userId, params.type, 'inapp');
  if (!allowed) return { inserted: false };
  const [row] = await db
    .insert(schema.notifications)
    .values({
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body ?? null,
      linkUrl: params.linkUrl ?? null,
    })
    .returning({ id: schema.notifications.id });
  return { inserted: true, id: row?.id };
}

/**
 * Send an email if the user hasn't opted out (transactional types bypass).
 */
export async function sendEmailIfEnabled(params: {
  userId: string;
  type: NotificationType;
  to: string;
  subject: string;
  html: string;
  from?: string;
}) {
  const allowed = await isChannelEnabled(params.userId, params.type, 'email');
  if (!allowed) return { id: 'skipped', skipped: true as const };
  return sendEmail({
    to: params.to,
    subject: params.subject,
    html: params.html,
    from: params.from,
  });
}
