import { and, eq, gte, lte, sum } from 'drizzle-orm';
import { db, schema } from '@/lib/db';

/**
 * Reconciliation report — sums the ledger for a reporting window and compares
 * it against the raw invoice + payout totals. A healthy platform has:
 *
 *    invoiceIssued + stripeFee + payoutSent + carryover + refund + adjustment = platformMargin
 *
 * Run via `pnpm tsx scripts/reconcile.ts 2026-04` or default = current UTC month.
 */
async function main() {
  const arg = process.argv[2];
  const month = arg ?? defaultMonth();
  const [year, mon] = month.split('-').map((n) => Number(n));
  if (!year || !mon || mon < 1 || mon > 12) {
    throw new Error(`Invalid month "${month}" — expected YYYY-MM`);
  }
  const start = new Date(Date.UTC(year, mon - 1, 1));
  const end = new Date(Date.UTC(year, mon, 1));

  const ledger = await db
    .select({ kind: schema.ledgerEntries.kind, amount: sum(schema.ledgerEntries.amountCents) })
    .from(schema.ledgerEntries)
    .where(
      and(
        gte(schema.ledgerEntries.occurredAt, start),
        lte(schema.ledgerEntries.occurredAt, end),
      ),
    )
    .groupBy(schema.ledgerEntries.kind);

  const by = new Map<string, number>();
  for (const row of ledger) by.set(row.kind, Number(row.amount ?? 0));

  const invoiceIssued = by.get('invoice_issued') ?? 0;
  const invoicePaid = by.get('invoice_paid') ?? 0;
  const payoutSent = by.get('payout_sent') ?? 0;
  const stripeFee = by.get('stripe_fee') ?? 0;
  const carryover = by.get('carryover') ?? 0;
  const refund = by.get('refund') ?? 0;
  const adjustment = by.get('adjustment') ?? 0;

  const platformMargin = invoicePaid + stripeFee + payoutSent + refund + adjustment;

  const [invAgg] = await db
    .select({ total: sum(schema.invoices.totalAmountCents) })
    .from(schema.invoices)
    .where(
      and(
        eq(schema.invoices.status, 'paid'),
        gte(schema.invoices.paidAt, start),
        lte(schema.invoices.paidAt, end),
      ),
    );

  const [payoutAgg] = await db
    .select({ total: sum(schema.payouts.amountCents) })
    .from(schema.payouts)
    .where(
      and(
        eq(schema.payouts.status, 'paid'),
        gte(schema.payouts.paidAt, start),
        lte(schema.payouts.paidAt, end),
      ),
    );

  const invoicesTable = Number(invAgg?.total ?? 0);
  const payoutsTable = Number(payoutAgg?.total ?? 0);

  const invoiceSkew = invoicesTable - invoicePaid;
  const payoutSkew = payoutsTable + payoutSent; // payoutSent is negative

  console.log(`Reconciliation for ${month}`);
  console.log(`  window            : ${start.toISOString()} → ${end.toISOString()}`);
  console.log(`  invoice_issued    : ${cents(invoiceIssued)}`);
  console.log(`  invoice_paid      : ${cents(invoicePaid)}`);
  console.log(`  stripe_fee        : ${cents(stripeFee)}`);
  console.log(`  payout_sent       : ${cents(payoutSent)}`);
  console.log(`  carryover         : ${cents(carryover)}`);
  console.log(`  refund            : ${cents(refund)}`);
  console.log(`  adjustment        : ${cents(adjustment)}`);
  console.log(`  platform margin   : ${cents(platformMargin)}`);
  console.log('');
  console.log(`  invoices.paid sum : ${cents(invoicesTable)}   skew: ${cents(invoiceSkew)}`);
  console.log(`  payouts.paid sum  : ${cents(payoutsTable)}   skew: ${cents(payoutSkew)}`);

  const healthy = invoiceSkew === 0 && payoutSkew === 0;
  if (!healthy) {
    console.error('RECONCILIATION SKEW DETECTED');
    process.exit(1);
  }
  console.log('\nOK — ledger reconciles to raw tables.');
  process.exit(0);
}

function cents(v: number): string {
  const sign = v < 0 ? '-' : '';
  const abs = Math.abs(v);
  return `${sign}$${(abs / 100).toFixed(2)}`;
}

function defaultMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
