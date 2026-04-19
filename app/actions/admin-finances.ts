'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/rbac';
import { db, schema } from '@/lib/db';
import { writeLedger } from '@/lib/billing/ledger';
import { runPayoutsForInvoice } from '@/lib/billing/payout';
import { currencyForRegion } from '@/lib/billing/region';

const UuidSchema = z.string().uuid();
const RegionSchema = z.enum(['us', 'co']);

export type AdminFinancesErrorCode =
  | 'invalid_input'
  | 'invoice_not_found'
  | 'payout_not_found'
  | 'bonus_not_found'
  | 'period_closed'
  | 'period_not_found'
  | 'period_has_draft_invoices'
  | 'not_manual_brand'
  | 'generic';
export type AdminFinancesInfoCode = 'marked_paid' | 'period_closed' | 'period_reopened';
export type AdminFinancesActionResult =
  | { ok: true; info: AdminFinancesInfoCode }
  | { ok: false; error: AdminFinancesErrorCode };

export async function adminMarkInvoicePaidAction(
  _prev: AdminFinancesActionResult | undefined,
  formData: FormData,
): Promise<AdminFinancesActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = UuidSchema.safeParse(String(formData.get('invoiceId') ?? ''));
    if (!parsed.success) return { ok: false, error: 'invalid_input' };

    const [invoice] = await db
      .select({
        id: schema.invoices.id,
        brandId: schema.invoices.brandId,
        periodStart: schema.invoices.periodStart,
        periodEnd: schema.invoices.periodEnd,
        fixedAmountCents: schema.invoices.fixedAmountCents,
        variableAmountCents: schema.invoices.variableAmountCents,
        currency: schema.invoices.currency,
        financeRegion: schema.invoices.financeRegion,
        status: schema.invoices.status,
        totalAmountCents: schema.invoices.totalAmountCents,
        paymentMethod: schema.brands.paymentMethod,
      })
      .from(schema.invoices)
      .innerJoin(schema.brands, eq(schema.brands.id, schema.invoices.brandId))
      .where(eq(schema.invoices.id, parsed.data))
      .limit(1);
    if (!invoice) return { ok: false, error: 'invoice_not_found' };
    if (invoice.paymentMethod !== 'manual') {
      return { ok: false, error: 'not_manual_brand' };
    }
    if (invoice.status === 'paid') {
      return { ok: true, info: 'marked_paid' };
    }

    const periodClosed = await isPeriodClosed({
      region: invoice.financeRegion,
      isoDate: invoice.periodEnd,
    });
    if (periodClosed) return { ok: false, error: 'period_closed' };

    const now = new Date();
    await db
      .update(schema.invoices)
      .set({ status: 'paid', paidAt: now, updatedAt: now })
      .where(eq(schema.invoices.id, invoice.id));

    await db
      .update(schema.brands)
      .set({ status: 'active', pastDueSince: null, deliverablesFrozen: false, updatedAt: now })
      .where(eq(schema.brands.id, invoice.brandId));

    await writeLedger({
      kind: 'invoice_paid',
      amountCents: invoice.totalAmountCents ?? 0,
      currency: invoice.currency,
      financeRegion: invoice.financeRegion,
      brandId: invoice.brandId,
      invoiceId: invoice.id,
      description: `Manual payment recorded by admin (${admin.email})`,
    });

    await db.insert(schema.auditLog).values({
      actorUserId: admin.userId,
      action: 'admin.invoice.marked_paid',
      entityType: 'invoice',
      entityId: invoice.id,
      after: { currency: invoice.currency, region: invoice.financeRegion },
    });

    try {
      await runPayoutsForInvoice({
        invoice: {
          id: invoice.id,
          brandId: invoice.brandId,
          periodStart: invoice.periodStart,
          periodEnd: invoice.periodEnd,
          fixedAmountCents: invoice.fixedAmountCents,
          variableAmountCents: invoice.variableAmountCents,
          currency: invoice.currency,
          financeRegion: invoice.financeRegion,
        },
        now,
      });
    } catch {
      // Non-fatal — cron retries.
    }

    revalidatePath('/admin/finances');
    revalidatePath('/admin/finances/invoices');
    return { ok: true, info: 'marked_paid' };
  } catch {
    return { ok: false, error: 'generic' };
  }
}

export async function adminMarkPayoutPaidAction(
  _prev: AdminFinancesActionResult | undefined,
  formData: FormData,
): Promise<AdminFinancesActionResult> {
  try {
    const admin = await requireAdmin();
    const payoutId = UuidSchema.safeParse(String(formData.get('payoutId') ?? ''));
    if (!payoutId.success) return { ok: false, error: 'invalid_input' };

    const [payout] = await db
      .select({
        id: schema.payouts.id,
        contractorUserId: schema.payouts.contractorUserId,
        amountCents: schema.payouts.amountCents,
        currency: schema.payouts.currency,
        financeRegion: schema.payouts.financeRegion,
        status: schema.payouts.status,
        periodStart: schema.payouts.periodStart,
        periodEnd: schema.payouts.periodEnd,
      })
      .from(schema.payouts)
      .where(eq(schema.payouts.id, payoutId.data))
      .limit(1);
    if (!payout) return { ok: false, error: 'payout_not_found' };
    if (payout.status === 'paid') {
      return { ok: true, info: 'marked_paid' };
    }

    const periodClosed = await isPeriodClosed({
      region: payout.financeRegion,
      isoDate: payout.periodEnd,
    });
    if (periodClosed) return { ok: false, error: 'period_closed' };

    const now = new Date();
    await db
      .update(schema.payouts)
      .set({ status: 'paid', paidAt: now, updatedAt: now })
      .where(eq(schema.payouts.id, payout.id));

    await writeLedger({
      kind: 'payout_sent',
      amountCents: -payout.amountCents,
      currency: payout.currency,
      financeRegion: payout.financeRegion,
      contractorUserId: payout.contractorUserId,
      payoutId: payout.id,
      description: `Manual payout paid by admin (${admin.email})`,
    });

    await db.insert(schema.auditLog).values({
      actorUserId: admin.userId,
      action: 'admin.payout.marked_paid',
      entityType: 'payout',
      entityId: payout.id,
      after: { currency: payout.currency, region: payout.financeRegion },
    });

    revalidatePath('/admin/finances/payouts');
    return { ok: true, info: 'marked_paid' };
  } catch {
    return { ok: false, error: 'generic' };
  }
}

async function isPeriodClosed(params: {
  region: 'us' | 'co';
  isoDate: string;
}): Promise<boolean> {
  const { region, isoDate } = params;
  const [y, m] = isoDate.split('-');
  const year = Number(y);
  const month = Number(m);
  const [p] = await db
    .select({ status: schema.financePeriods.status })
    .from(schema.financePeriods)
    .where(
      and(
        eq(schema.financePeriods.financeRegion, region),
        eq(schema.financePeriods.year, year),
        eq(schema.financePeriods.month, month),
      ),
    )
    .limit(1);
  return p?.status === 'closed';
}

const CloseSchema = z.object({
  financeRegion: RegionSchema,
  year: z.coerce.number().int().min(2024).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

export async function adminCloseFinancePeriodAction(
  _prev: AdminFinancesActionResult | undefined,
  formData: FormData,
): Promise<AdminFinancesActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = CloseSchema.safeParse({
      financeRegion: String(formData.get('financeRegion') ?? ''),
      year: String(formData.get('year') ?? ''),
      month: String(formData.get('month') ?? ''),
    });
    if (!parsed.success) return { ok: false, error: 'invalid_input' };
    const { financeRegion, year, month } = parsed.data;
    const currency = currencyForRegion(financeRegion);

    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const monthEnd = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

    const draftCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.invoices)
      .where(
        and(
          eq(schema.invoices.financeRegion, financeRegion),
          eq(schema.invoices.status, 'draft'),
          sql`${schema.invoices.periodEnd} >= ${monthStart}`,
          sql`${schema.invoices.periodEnd} < ${monthEnd}`,
        ),
      );
    if ((draftCount[0]?.count ?? 0) > 0) {
      return { ok: false, error: 'period_has_draft_invoices' };
    }

    const totals = await computeFinancePeriodTotals({
      financeRegion,
      monthStart,
      monthEnd,
    });

    const now = new Date();
    await db
      .insert(schema.financePeriods)
      .values({
        financeRegion,
        currency,
        year,
        month,
        status: 'closed',
        revenueCents: totals.revenueCents,
        payoutsCents: totals.payoutsCents,
        bonusesCents: totals.bonusesCents,
        netCents: totals.netCents,
        closedAt: now,
        closedByUserId: admin.userId,
      })
      .onConflictDoUpdate({
        target: [
          schema.financePeriods.financeRegion,
          schema.financePeriods.year,
          schema.financePeriods.month,
        ],
        set: {
          currency,
          status: 'closed',
          revenueCents: totals.revenueCents,
          payoutsCents: totals.payoutsCents,
          bonusesCents: totals.bonusesCents,
          netCents: totals.netCents,
          closedAt: now,
          closedByUserId: admin.userId,
          updatedAt: now,
        },
      });

    await db.insert(schema.auditLog).values({
      actorUserId: admin.userId,
      action: 'admin.finance_period.closed',
      entityType: 'finance_period',
      after: { financeRegion, year, month, ...totals },
    });

    revalidatePath('/admin/finances/close');
    return { ok: true, info: 'period_closed' };
  } catch {
    return { ok: false, error: 'generic' };
  }
}

export async function adminReopenFinancePeriodAction(
  _prev: AdminFinancesActionResult | undefined,
  formData: FormData,
): Promise<AdminFinancesActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = CloseSchema.safeParse({
      financeRegion: String(formData.get('financeRegion') ?? ''),
      year: String(formData.get('year') ?? ''),
      month: String(formData.get('month') ?? ''),
    });
    if (!parsed.success) return { ok: false, error: 'invalid_input' };
    const { financeRegion, year, month } = parsed.data;

    const [existing] = await db
      .select({ id: schema.financePeriods.id })
      .from(schema.financePeriods)
      .where(
        and(
          eq(schema.financePeriods.financeRegion, financeRegion),
          eq(schema.financePeriods.year, year),
          eq(schema.financePeriods.month, month),
        ),
      )
      .limit(1);
    if (!existing) return { ok: false, error: 'period_not_found' };

    const now = new Date();
    await db
      .update(schema.financePeriods)
      .set({
        status: 'open',
        closedAt: null,
        closedByUserId: null,
        updatedAt: now,
      })
      .where(eq(schema.financePeriods.id, existing.id));

    await db.insert(schema.auditLog).values({
      actorUserId: admin.userId,
      action: 'admin.finance_period.reopened',
      entityType: 'finance_period',
      entityId: existing.id,
    });

    revalidatePath('/admin/finances/close');
    return { ok: true, info: 'period_reopened' };
  } catch {
    return { ok: false, error: 'generic' };
  }
}

export async function computeFinancePeriodTotals(params: {
  financeRegion: 'us' | 'co';
  monthStart: string;
  monthEnd: string;
}): Promise<{
  revenueCents: number;
  payoutsCents: number;
  bonusesCents: number;
  netCents: number;
}> {
  const { financeRegion, monthStart, monthEnd } = params;

  const revenue = await db
    .select({
      total: sql<number>`coalesce(sum(${schema.invoices.totalAmountCents}), 0)::bigint`,
    })
    .from(schema.invoices)
    .where(
      and(
        eq(schema.invoices.financeRegion, financeRegion),
        eq(schema.invoices.status, 'paid'),
        sql`${schema.invoices.paidAt} >= ${monthStart}`,
        sql`${schema.invoices.paidAt} < ${monthEnd}`,
      ),
    );

  const payouts = await db
    .select({
      total: sql<number>`coalesce(sum(${schema.payouts.amountCents}), 0)::bigint`,
    })
    .from(schema.payouts)
    .where(
      and(
        eq(schema.payouts.financeRegion, financeRegion),
        eq(schema.payouts.status, 'paid'),
        sql`${schema.payouts.paidAt} >= ${monthStart}`,
        sql`${schema.payouts.paidAt} < ${monthEnd}`,
      ),
    );

  const bonuses = await db
    .select({
      total: sql<number>`coalesce(sum(${schema.contractorBonuses.amountCents}), 0)::bigint`,
    })
    .from(schema.contractorBonuses)
    .where(
      and(
        eq(schema.contractorBonuses.financeRegion, financeRegion),
        eq(schema.contractorBonuses.status, 'paid'),
        sql`${schema.contractorBonuses.resolvedAt} >= ${monthStart}`,
        sql`${schema.contractorBonuses.resolvedAt} < ${monthEnd}`,
      ),
    );

  const revenueCents = Number(revenue[0]?.total ?? 0);
  const payoutsCents = Number(payouts[0]?.total ?? 0);
  const bonusesCents = Number(bonuses[0]?.total ?? 0);
  const netCents = revenueCents - payoutsCents - bonusesCents;

  return { revenueCents, payoutsCents, bonusesCents, netCents };
}
