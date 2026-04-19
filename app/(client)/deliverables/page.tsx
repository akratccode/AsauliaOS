import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { Board } from '@/components/kanban/Board';
import type { KanbanDeliverable } from '@/components/kanban/types';
import { requireAuth } from '@/lib/auth/rbac';
import { db, schema } from '@/lib/db';
import { eq, inArray, sql } from 'drizzle-orm';
import {
  currentUtcPeriod,
  monthStringToPeriod,
} from '@/lib/billing/period';
import { listDeliverablesForBrand } from '@/lib/deliverables/service';
import { summarizeAllocation } from '@/lib/deliverables/allocation';

type SearchParams = Promise<{ brandId?: string; period?: string }>;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('client.deliverables');
  return { title: t('metadata') };
}

async function resolveBrandId(
  userId: string,
  globalRole: string,
  requested?: string,
): Promise<string | null> {
  if (requested) return requested;
  if (globalRole === 'admin' || globalRole === 'operator') return null;
  const row = await db
    .select({ brandId: schema.brandMembers.brandId })
    .from(schema.brandMembers)
    .where(eq(schema.brandMembers.userId, userId))
    .limit(1);
  return row[0]?.brandId ?? null;
}

export default async function ClientDeliverablesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const actor = await requireAuth();
  const brandId = await resolveBrandId(actor.userId, actor.globalRole, sp.brandId);

  if (!brandId) {
    redirect('/onboarding/brand');
  }

  const period = sp.period ? monthStringToPeriod(sp.period) : currentUtcPeriod();
  const rows = await listDeliverablesForBrand(actor, brandId, period);
  const ids = rows.map((r) => r.id);

  const commentCounts = new Map<string, number>();
  const attachmentCounts = new Map<string, number>();
  if (ids.length > 0) {
    const [comments, attachments] = await Promise.all([
      db
        .select({
          deliverableId: schema.deliverableComments.deliverableId,
          count: sql<number>`count(*)::int`,
        })
        .from(schema.deliverableComments)
        .where(inArray(schema.deliverableComments.deliverableId, ids))
        .groupBy(schema.deliverableComments.deliverableId),
      db
        .select({
          deliverableId: schema.deliverableAttachments.deliverableId,
          count: sql<number>`count(*)::int`,
        })
        .from(schema.deliverableAttachments)
        .where(inArray(schema.deliverableAttachments.deliverableId, ids))
        .groupBy(schema.deliverableAttachments.deliverableId),
    ]);
    for (const row of comments) commentCounts.set(row.deliverableId, row.count);
    for (const row of attachments) attachmentCounts.set(row.deliverableId, row.count);
  }

  const cards: KanbanDeliverable[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    type: r.type,
    status: r.status,
    dueDate: r.dueDate,
    fixedShareBps: r.fixedShareBps,
    assigneeUserId: r.assigneeUserId,
    commentsCount: commentCounts.get(r.id) ?? 0,
    attachmentsCount: attachmentCounts.get(r.id) ?? 0,
  }));

  const summary = summarizeAllocation(rows);
  const t = await getTranslations('client.deliverables');

  const flagLabel =
    summary.flag === 'exact'
      ? t('flagExact')
      : summary.flag === 'over_allocated'
        ? t('flagOver')
        : t('flagUnder');

  return (
    <main className="mx-auto w-full max-w-6xl space-y-4 p-6">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-fg-2 text-xs uppercase tracking-[0.12em]">{t('sectionLabel')}</p>
          <h1 className="text-fg-1 font-serif text-3xl italic">{t('pageTitle')}</h1>
        </div>
        <div
          className={`rounded-md border px-3 py-1.5 text-xs ${
            summary.flag === 'exact'
              ? 'border-asaulia-green/40 text-asaulia-green'
              : 'border-asaulia-red/40 text-asaulia-red'
          }`}
        >
          {t('allocation')} {(summary.totalBps / 100).toFixed(1)}% · {flagLabel}
        </div>
      </header>
      <Board initialDeliverables={cards} />
    </main>
  );
}
