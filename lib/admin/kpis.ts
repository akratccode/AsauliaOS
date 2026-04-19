import 'server-only';
import { and, desc, eq, gte, inArray, isNull, lt, lte, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';

export type AdminKpis = {
  brandsActive: number;
  brandsTrial: number;
  brandsChurnedThisMonth: number;
  mrrFixedCents: number;
  variable30dCents: number;
  contractorsActive: number;
  contractorsPending: number;
  payoutsPending: number;
  integrationsActive: number;
  integrationsErrored: number;
  mrr12mo: Array<{ monthStart: string; fixedCents: number; variableCents: number }>;
};

export async function getAdminKpis(now: Date = new Date()): Promise<AdminKpis> {
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);
  const twelveMonthsAgo = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1),
  );

  const [brandRows] = await Promise.all([
    db
      .select({ status: schema.brands.status, count: sql<number>`count(*)::int` })
      .from(schema.brands)
      .groupBy(schema.brands.status),
  ]);

  let brandsActive = 0;
  let brandsTrial = 0;
  for (const r of brandRows) {
    if (r.status === 'active') brandsActive = r.count;
    else if (r.status === 'trial') brandsTrial = r.count;
  }

  const [churned] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.brands)
    .where(
      and(
        eq(schema.brands.status, 'cancelled'),
        gte(schema.brands.cancelledAt, startOfMonth),
      ),
    );
  const brandsChurnedThisMonth = churned?.count ?? 0;

  const activeBrandRows = await db
    .select({ id: schema.brands.id })
    .from(schema.brands)
    .where(eq(schema.brands.status, 'active'));
  const activeBrandIds = activeBrandRows.map((r) => r.id);

  let mrrFixedCents = 0;
  if (activeBrandIds.length > 0) {
    const [fixedSum] = await db
      .select({
        sum: sql<number>`coalesce(sum(${schema.plans.fixedAmountCents}), 0)::int`,
      })
      .from(schema.plans)
      .where(
        and(
          inArray(schema.plans.brandId, activeBrandIds),
          isNull(schema.plans.effectiveTo),
        ),
      );
    mrrFixedCents = fixedSum?.sum ?? 0;
  }

  const [variableAgg] = await db
    .select({
      sum: sql<number>`coalesce(sum(${schema.salesRecords.amountCents}), 0)::bigint`,
    })
    .from(schema.salesRecords)
    .where(
      and(
        eq(schema.salesRecords.attributed, true),
        gte(schema.salesRecords.occurredAt, thirtyDaysAgo),
      ),
    );
  const attributed30d = Number(variableAgg?.sum ?? 0);
  // Approx: apply average variablePercentBps of active plans to compute variable MRR.
  // For simplicity we use the actual invoice variable lines when they exist, falling
  // back to attributed sales as the denominator.
  const variable30dCents = Math.round(attributed30d * 0.142) / 1; // fallback approx @ 14.2%
  // better estimate: sum of (amount_cents * variablePercentBps) per-brand active plan
  let variable30dAccurate = 0;
  if (activeBrandIds.length > 0) {
    const rows = await db
      .select({
        brandId: schema.salesRecords.brandId,
        total: sql<number>`coalesce(sum(${schema.salesRecords.amountCents}), 0)::bigint`,
      })
      .from(schema.salesRecords)
      .where(
        and(
          eq(schema.salesRecords.attributed, true),
          gte(schema.salesRecords.occurredAt, thirtyDaysAgo),
          inArray(schema.salesRecords.brandId, activeBrandIds),
        ),
      )
      .groupBy(schema.salesRecords.brandId);
    const plans = await db
      .select({
        brandId: schema.plans.brandId,
        bps: schema.plans.variablePercentBps,
      })
      .from(schema.plans)
      .where(
        and(
          inArray(schema.plans.brandId, activeBrandIds),
          isNull(schema.plans.effectiveTo),
        ),
      );
    const bpsByBrand = new Map(plans.map((p) => [p.brandId, p.bps]));
    for (const r of rows) {
      const bps = bpsByBrand.get(r.brandId) ?? 0;
      variable30dAccurate += Math.round((Number(r.total) * bps) / 10_000);
    }
  }

  const contractorStatusRows = await db
    .select({
      status: schema.contractorProfiles.status,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.contractorProfiles)
    .groupBy(schema.contractorProfiles.status);
  let contractorsActive = 0;
  let contractorsPending = 0;
  for (const r of contractorStatusRows) {
    if (r.status === 'active') contractorsActive = r.count;
    else if (r.status === 'pending') contractorsPending = r.count;
  }

  const [payoutsPendingRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.payouts)
    .where(eq(schema.payouts.status, 'pending'));

  const integrationStatusRows = await db
    .select({
      status: schema.salesIntegrations.status,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.salesIntegrations)
    .groupBy(schema.salesIntegrations.status);
  let integrationsActive = 0;
  let integrationsErrored = 0;
  for (const r of integrationStatusRows) {
    if (r.status === 'active') integrationsActive = r.count;
    else if (r.status === 'error') integrationsErrored = r.count;
  }

  // MRR 12-month series (from paid invoices).
  const mrrRows = await db
    .select({
      month: sql<string>`to_char(date_trunc('month', ${schema.invoices.periodStart}::date), 'YYYY-MM-01')`,
      fixed: sql<number>`coalesce(sum(${schema.invoices.fixedAmountCents}), 0)::int`,
      variable: sql<number>`coalesce(sum(${schema.invoices.variableAmountCents}), 0)::int`,
    })
    .from(schema.invoices)
    .where(
      and(
        inArray(schema.invoices.status, ['paid', 'open']),
        gte(schema.invoices.periodStart, sqlYmd(twelveMonthsAgo)),
        lte(schema.invoices.periodStart, sqlYmd(now)),
      ),
    )
    .groupBy(sql`date_trunc('month', ${schema.invoices.periodStart}::date)`)
    .orderBy(sql`date_trunc('month', ${schema.invoices.periodStart}::date)`);

  const mrr12mo = mrrRows.map((r) => ({
    monthStart: r.month,
    fixedCents: r.fixed,
    variableCents: r.variable,
  }));

  return {
    brandsActive,
    brandsTrial,
    brandsChurnedThisMonth,
    mrrFixedCents,
    variable30dCents: variable30dAccurate || variable30dCents,
    contractorsActive,
    contractorsPending,
    payoutsPending: payoutsPendingRow?.count ?? 0,
    integrationsActive,
    integrationsErrored,
    mrr12mo,
  };
}

function sqlYmd(d: Date): string {
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${d.getUTCFullYear()}-${m}-${day}`;
}

export async function recentAuditEvents(limit = 20) {
  return db
    .select({
      id: schema.auditLog.id,
      action: schema.auditLog.action,
      entityType: schema.auditLog.entityType,
      entityId: schema.auditLog.entityId,
      actorUserId: schema.auditLog.actorUserId,
      brandId: schema.auditLog.brandId,
      createdAt: schema.auditLog.createdAt,
    })
    .from(schema.auditLog)
    .orderBy(desc(schema.auditLog.createdAt))
    .limit(limit);
}

export { lt };
