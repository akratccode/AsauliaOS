import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { desc, eq, isNull, sql } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/rbac';
import { db, schema } from '@/lib/db';
import { resolveActiveBrand } from '@/lib/brand/context';
import { resolveBillingWindow } from '@/lib/brand/billing-period';
import { Sidebar, BottomNav } from '@/components/client-shell/Sidebar';
import { BrandSwitcher } from '@/components/client-shell/BrandSwitcher';
import { NotificationBell } from '@/components/client-shell/NotificationBell';

export default async function ClientLayout({ children }: { children: ReactNode }) {
  const actor = await requireAuth();
  const { active, available } = await resolveActiveBrand(actor);

  if (!active) {
    redirect('/onboarding/brand');
  }

  const brandRow = await db
    .select({
      billingCycleDay: schema.brands.billingCycleDay,
      status: schema.brands.status,
    })
    .from(schema.brands)
    .where(eq(schema.brands.id, active.id))
    .limit(1);

  const window = resolveBillingWindow(brandRow[0]?.billingCycleDay ?? null);

  const [unread] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.notifications)
    .where(
      sql`${schema.notifications.userId} = ${actor.userId} and ${schema.notifications.readAt} is null`,
    );

  const items = await db
    .select({
      id: schema.notifications.id,
      title: schema.notifications.title,
      body: schema.notifications.body,
      linkUrl: schema.notifications.linkUrl,
      createdAt: schema.notifications.createdAt,
      readAt: schema.notifications.readAt,
    })
    .from(schema.notifications)
    .where(eq(schema.notifications.userId, actor.userId))
    .orderBy(desc(schema.notifications.createdAt))
    .limit(10);
  // silence unused-import warning if RLS renders isNull unnecessary
  void isNull;

  return (
    <div className="bg-bg-0 text-fg-1 flex min-h-dvh">
      <Sidebar />
      <div className="flex w-full flex-col pb-16 md:pb-0">
        <header className="border-fg-4/10 flex items-center justify-between gap-4 border-b px-6 py-3">
          <div className="flex items-center gap-3">
            <BrandSwitcher
              active={{ id: active.id, name: active.name }}
              brands={available.map((b) => ({ id: b.id, name: b.name }))}
            />
            <span className="text-fg-3 hidden text-xs md:inline">
              Period · {window.label}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell
              unreadCount={unread?.count ?? 0}
              items={items.map((i) => ({
                id: i.id,
                title: i.title,
                body: i.body,
                linkUrl: i.linkUrl,
                createdAt: i.createdAt.toISOString(),
                readAt: i.readAt?.toISOString() ?? null,
              }))}
            />
            <span className="text-fg-3 hidden text-xs md:inline">{actor.email}</span>
          </div>
        </header>
        <div className="flex-1">{children}</div>
        <BottomNav />
      </div>
    </div>
  );
}
