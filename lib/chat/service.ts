import 'server-only';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';

/**
 * Ensure a chat thread exists for the brand. Thread is keyed on brand_id
 * (unique index) — safe to call concurrently. Uses ON CONFLICT DO NOTHING
 * and re-selects so callers always get the row.
 */
export async function ensureThreadForBrand(brandId: string): Promise<string> {
  await db
    .insert(schema.chatThreads)
    .values({ brandId })
    .onConflictDoNothing({ target: schema.chatThreads.brandId });
  const [row] = await db
    .select({ id: schema.chatThreads.id })
    .from(schema.chatThreads)
    .where(eq(schema.chatThreads.brandId, brandId))
    .limit(1);
  if (!row) throw new Error('chat thread insert failed');
  return row.id;
}

export async function listMessages(threadId: string, limit = 100) {
  const rows = await db
    .select({
      id: schema.chatMessages.id,
      threadId: schema.chatMessages.threadId,
      userId: schema.chatMessages.userId,
      content: schema.chatMessages.content,
      createdAt: schema.chatMessages.createdAt,
      editedAt: schema.chatMessages.editedAt,
      deletedAt: schema.chatMessages.deletedAt,
    })
    .from(schema.chatMessages)
    .where(eq(schema.chatMessages.threadId, threadId))
    .orderBy(desc(schema.chatMessages.createdAt))
    .limit(limit);
  return rows.reverse();
}

export async function postMessage(params: {
  threadId: string;
  userId: string;
  content: string;
}): Promise<{ id: string }> {
  const trimmed = params.content.trim();
  if (!trimmed) throw new Error('empty_message');
  if (trimmed.length > 4000) throw new Error('message_too_long');

  const [inserted] = await db
    .insert(schema.chatMessages)
    .values({
      threadId: params.threadId,
      userId: params.userId,
      content: trimmed,
    })
    .returning({ id: schema.chatMessages.id });
  if (!inserted) throw new Error('chat insert failed');

  await db
    .update(schema.chatThreads)
    .set({ lastMessageAt: new Date() })
    .where(eq(schema.chatThreads.id, params.threadId));

  return { id: inserted.id };
}

export async function markRead(threadId: string, userId: string): Promise<void> {
  const now = new Date();
  await db
    .insert(schema.chatParticipants)
    .values({ threadId, userId, lastReadAt: now })
    .onConflictDoUpdate({
      target: [schema.chatParticipants.threadId, schema.chatParticipants.userId],
      set: { lastReadAt: now },
    });
}

export async function unreadCount(threadId: string, userId: string): Promise<number> {
  const [row] = await db
    .select({
      lastReadAt: schema.chatParticipants.lastReadAt,
    })
    .from(schema.chatParticipants)
    .where(
      and(
        eq(schema.chatParticipants.threadId, threadId),
        eq(schema.chatParticipants.userId, userId),
      ),
    )
    .limit(1);
  const cutoff = row?.lastReadAt ?? new Date(0);
  const [agg] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.chatMessages)
    .where(
      and(
        eq(schema.chatMessages.threadId, threadId),
        sql`${schema.chatMessages.createdAt} > ${cutoff}`,
      ),
    );
  return Number(agg?.count ?? 0);
}
