import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { requireAuth } from '@/lib/auth/rbac';
import { resolveActiveBrand, requireClientBrandAccess } from '@/lib/brand/context';
import { ensureThreadForBrand, listMessages, markRead } from '@/lib/chat/service';
import { db, schema } from '@/lib/db';
import { inArray } from 'drizzle-orm';
import { formatDate } from '@/lib/format';
import { ChatComposer } from './composer';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('client.chat');
  return { title: t('metadata') };
}

export default async function ChatPage() {
  const actor = await requireAuth();
  const { active } = await resolveActiveBrand(actor);
  if (!active) redirect('/onboarding/brand');
  await requireClientBrandAccess(actor, active.id);

  const threadId = await ensureThreadForBrand(active.id);
  const messages = await listMessages(threadId, 200);
  await markRead(threadId, actor.userId);

  const userIds = Array.from(new Set(messages.map((m) => m.userId)));
  const users = userIds.length
    ? await db
        .select({ id: schema.users.id, email: schema.users.email, fullName: schema.users.fullName })
        .from(schema.users)
        .where(inArray(schema.users.id, userIds))
    : [];
  const byId = new Map(users.map((u) => [u.id, u]));

  const t = await getTranslations('client.chat');

  return (
    <main className="mx-auto flex h-[calc(100vh-4rem)] w-full max-w-3xl flex-col p-6">
      <header className="mb-4">
        <p className="text-fg-3 text-xs uppercase tracking-[0.12em]">{t('supportHeader')}</p>
        <h1 className="text-fg-1 font-serif text-3xl italic">{t('chatWithAsaulia')}</h1>
        <p className="text-fg-3 mt-1 text-xs">{t('asyncNote')}</p>
      </header>

      <section className="border-fg-4/15 bg-bg-1 flex-1 space-y-3 overflow-y-auto rounded-2xl border p-4">
        {messages.length === 0 ? (
          <p className="text-fg-3 text-sm">{t('noMessages')}</p>
        ) : (
          messages.map((m) => {
            const user = byId.get(m.userId);
            const isSelf = m.userId === actor.userId;
            return (
              <div key={m.id} className={`flex ${isSelf ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm ${
                    isSelf ? 'bg-fg-1 text-bg-0' : 'bg-bg-2 text-fg-1'
                  }`}
                >
                  <div className="text-fg-3 mb-1 text-xs">
                    {user?.fullName ?? user?.email ?? '—'} · {formatDate(m.createdAt)}
                  </div>
                  <div className="whitespace-pre-wrap">{m.content}</div>
                </div>
              </div>
            );
          })
        )}
      </section>

      <ChatComposer />
    </main>
  );
}
