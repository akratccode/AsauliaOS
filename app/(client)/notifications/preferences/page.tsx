import { eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/rbac';
import { db, schema } from '@/lib/db';
import type { NotificationType } from '@/lib/notifications/service';
import { PreferencesForm } from './form';

const LABELS: Array<{ type: NotificationType; label: string }> = [
  { type: 'welcome', label: 'Welcome & onboarding' },
  { type: 'invite', label: 'Team invites' },
  { type: 'deliverable_assigned', label: 'New deliverable assigned' },
  { type: 'deliverable_approved', label: 'Deliverable approved' },
  { type: 'deliverable_rejected', label: 'Revisions requested' },
  { type: 'cycle_close_summary', label: 'Monthly cycle summary' },
  { type: 'plan_change_confirmed', label: 'Plan change confirmations' },
  { type: 'chat_message', label: 'New chat messages' },
];

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

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 p-6">
      <header>
        <p className="text-fg-3 text-xs uppercase tracking-[0.12em]">Account</p>
        <h1 className="text-fg-1 font-serif text-3xl italic">Notifications</h1>
        <p className="text-fg-3 mt-1 text-xs">
          Transactional messages (invoices, payouts, payment failures, password
          resets) cannot be disabled.
        </p>
      </header>

      <section className="border-fg-4/15 bg-bg-1 rounded-2xl border p-5">
        <PreferencesForm labels={LABELS} initial={initialMap} />
      </section>
    </main>
  );
}

