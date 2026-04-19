import 'server-only';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { quote } from '@/lib/pricing';
import { attributedSalesForPeriod } from '@/lib/integrations/service';
import {
  resolveBillingWindow,
  type BillingPeriodWindow,
} from '@/lib/brand/billing-period';
import type { DeliverableStatus } from '@/lib/deliverables/types';

export type DashboardStats = {
  window: BillingPeriodWindow;
  deliverablesByStatus: Record<DeliverableStatus, number>;
  deliverablesTotal: number;
  deliverablesDone: number;
  attributedSalesCents: number;
  attributedSalesCount: number;
  projectedInvoiceCents: number;
  plan: {
    fixedAmountCents: number;
    variablePercentBps: number;
  } | null;
  dailySales: Array<{ date: string; cents: number }>;
  recentActivity: Array<{
    id: string;
    action: string;
    message: string;
    createdAt: Date;
    deliverableId: string | null;
  }>;
};

export async function getDashboardData(
  brandId: string,
  billingCycleDay: number | null,
  now: Date = new Date(),
): Promise<DashboardStats> {
  const window = resolveBillingWindow(billingCycleDay, now);

  const [plan] = await db
    .select()
    .from(schema.plans)
    .where(and(eq(schema.plans.brandId, brandId), sql`${schema.plans.effectiveTo} is null`))
    .limit(1);

  const statusRows = await db
    .select({
      status: schema.deliverables.status,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.deliverables)
    .where(
      and(
        eq(schema.deliverables.brandId, brandId),
        sql`${schema.deliverables.archivedAt} is null`,
        gte(schema.deliverables.periodStart, sqlDate(window.start)),
        lte(schema.deliverables.periodEnd, sqlDate(endOfDayBefore(window.end))),
      ),
    )
    .groupBy(schema.deliverables.status);

  const deliverablesByStatus: Record<DeliverableStatus, number> = {
    todo: 0,
    in_progress: 0,
    in_review: 0,
    done: 0,
    rejected: 0,
  };
  for (const row of statusRows) {
    deliverablesByStatus[row.status as DeliverableStatus] = row.count;
  }
  const deliverablesTotal = Object.values(deliverablesByStatus).reduce((a, b) => a + b, 0);
  const deliverablesDone = deliverablesByStatus.done;

  const salesTotals = await attributedSalesForPeriod(brandId, {
    start: window.start,
    end: window.end,
  });

  const dailyRows = await db
    .select({
      day: sql<string>`to_char(${schema.salesRecords.occurredAt} at time zone 'UTC', 'YYYY-MM-DD')`,
      cents: sql<number>`coalesce(sum(${schema.salesRecords.amountCents}), 0)::int`,
    })
    .from(schema.salesRecords)
    .where(
      and(
        eq(schema.salesRecords.brandId, brandId),
        eq(schema.salesRecords.attributed, true),
        gte(schema.salesRecords.occurredAt, window.start),
        lte(schema.salesRecords.occurredAt, window.end),
      ),
    )
    .groupBy(sql`to_char(${schema.salesRecords.occurredAt} at time zone 'UTC', 'YYYY-MM-DD')`);

  const dailyByDate = new Map<string, number>();
  for (const r of dailyRows) dailyByDate.set(r.day, r.cents);

  const dailySales: Array<{ date: string; cents: number }> = [];
  const msPerDay = 86_400_000;
  for (let ts = window.start.getTime(); ts < window.end.getTime(); ts += msPerDay) {
    const d = new Date(ts);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    dailySales.push({ date: key, cents: dailyByDate.get(key) ?? 0 });
  }

  const projectedInvoiceCents = plan
    ? quote({
        fixedAmountCents: plan.fixedAmountCents,
        variablePercentBps: plan.variablePercentBps,
        attributedSalesCents: salesTotals.totalCents,
      }).totalAmountCents
    : salesTotals.totalCents;

  const activity = await db
    .select({
      id: schema.deliverableActivity.id,
      action: schema.deliverableActivity.action,
      payload: schema.deliverableActivity.payload,
      createdAt: schema.deliverableActivity.createdAt,
      deliverableId: schema.deliverableActivity.deliverableId,
      title: schema.deliverables.title,
    })
    .from(schema.deliverableActivity)
    .innerJoin(
      schema.deliverables,
      eq(schema.deliverableActivity.deliverableId, schema.deliverables.id),
    )
    .where(eq(schema.deliverables.brandId, brandId))
    .orderBy(desc(schema.deliverableActivity.createdAt))
    .limit(5);

  return {
    window,
    deliverablesByStatus,
    deliverablesTotal,
    deliverablesDone,
    attributedSalesCents: salesTotals.totalCents,
    attributedSalesCount: salesTotals.count,
    projectedInvoiceCents,
    plan: plan
      ? {
          fixedAmountCents: plan.fixedAmountCents,
          variablePercentBps: plan.variablePercentBps,
        }
      : null,
    dailySales,
    recentActivity: activity.map((a) => ({
      id: a.id,
      action: a.action,
      message: formatActivityMessage(a.action, a.title, a.payload),
      createdAt: a.createdAt,
      deliverableId: a.deliverableId,
    })),
  };
}

function formatActivityMessage(
  action: string,
  title: string,
  payload: unknown,
): string {
  if (action === 'status_changed') {
    const p = payload as { from?: string; to?: string } | null;
    return `${title} moved ${p?.from ?? ''} → ${p?.to ?? ''}`;
  }
  if (action === 'comment_added') return `New comment on ${title}`;
  if (action === 'attachment_added') return `Attachment added to ${title}`;
  if (action === 'assigned') return `${title} reassigned`;
  if (action === 'created') return `${title} created`;
  return `${action.replace('_', ' ')}: ${title}`;
}

function sqlDate(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function endOfDayBefore(d: Date): Date {
  return new Date(d.getTime() - 24 * 60 * 60 * 1000);
}
