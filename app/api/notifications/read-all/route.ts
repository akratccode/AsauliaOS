import { NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/rbac';
import { db, schema } from '@/lib/db';

export async function POST() {
  const actor = await requireAuth();
  await db
    .update(schema.notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(schema.notifications.userId, actor.userId),
        isNull(schema.notifications.readAt),
      ),
    );
  return NextResponse.json({ ok: true });
}
