import { eq } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { requireAuth } from '@/lib/auth/rbac';
import { db, schema } from '@/lib/db';
import type { NotificationType } from '@/lib/notifications/service';
import { PreferencesForm } from './form';

type LabelKey =
  | 'welcome'
  | 'teamInvites'
  | 'deliverableAssigned'
  | 'deliverableApproved'
  | 'deliverableRejected'
  | 'cycleCloseSummary'
  | 'planChangeConfirmed'
  | 'chatMessage';

const LABELS: Array<{ type: NotificationType; labelKey: LabelKey }> = [
  { type: 'welcome', labelKey: 'welcome' },
  { type: 'invite', labelKey: 'teamInvites' },
  { type: 'deliverable_assigned', labelKey: 'deliverableAssigned' },
  { type: 'deliverable_approved', labelKey: 'deliverableApproved' },
  { type: 'deliverable_rejected', labelKey: 'deliverableRejected' },
  { type: 'cycle_close_summary', labelKey: 'cycleCloseSummary' },
  { type: 'plan_change_confirmed', labelKey: 'planChangeConfirmed' },
  { type: 'chat_message', labelKey: 'chatMessage' },
];

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('client.notifications');
  return { title: t('metadata') };
}

export default async function PreferencesPage() {
  const actor = await requireAuth();

  const prefs = await db
    .select()
    .from(schema.notificationPreferences)
    .where(eq(schema.notificationPreferences.userId, actor.userId));

  const keyOf = (type: string, channel: string) => `${type}:${channel}`;
  const map = new Map<string, boolean>();
  for (const p of prefs) map.set(keyOf(p.type, p.channel), p.enabled);

  const initial = LABELS.flatMap(({ type }) => [
    { key: keyOf(type, 'email'), enabled: map.get(keyOf(type, 'email')) ?? true },
    { key: keyOf(type, 'inapp'), enabled: map.get(keyOf(type, 'inapp')) ?? true },
  ]);
  const initialMap = Object.fromEntries(initial.map((e) => [e.key, e.enabled]));

  const t = await getTranslations('client.notifications');

  const labels = LABELS.map(({ type, labelKey }) => ({ type, label: t(labelKey) }));

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 p-6">
      <header>
        <p className="text-fg-3 text-xs uppercase tracking-[0.12em]">{t('accountLabel')}</p>
        <h1 className="text-fg-1 font-serif text-3xl italic">{t('notificationsTitle')}</h1>
        <p className="text-fg-3 mt-1 text-xs">{t('transactionalNote')}</p>
      </header>

      <section className="border-fg-4/15 bg-bg-1 rounded-2xl border p-5">
        <PreferencesForm labels={labels} initial={initialMap} />
      </section>
    </main>
  );
}
