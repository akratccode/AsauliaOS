import 'server-only';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';

type LedgerKind =
  | 'invoice_issued'
  | 'invoice_paid'
  | 'payout_sent'
  | 'payout_failed'
  | 'refund'
  | 'stripe_fee'
  | 'adjustment'
  | 'carryover';

/**
 * Single write path into `ledger_entries`. Every money movement goes through
 * here — the reconciliation script in Phase 11 §9 sums these rows to verify
 * platform margin.
 *
 * `stripeEventId` is deduped via a unique index so Stripe webhook replays
 * (they retry for up to 3 days) do not double-book.
 */
export async function writeLedger(entry: {
  kind: LedgerKind;
  amountCents: number;
  brandId?: string;
  contractorUserId?: string;
  invoiceId?: string;
  payoutId?: string;
  description?: string;
  stripeEventId?: string;
  occurredAt?: Date;
}): Promise<{ inserted: boolean; id?: string }> {
  if (entry.stripeEventId) {
    const existing = await db
      .select({ id: schema.ledgerEntries.id })
      .from(schema.ledgerEntries)
      .where(eq(schema.ledgerEntries.stripeEventId, entry.stripeEventId))
      .limit(1);
    if (existing[0]) return { inserted: false, id: existing[0].id };
  }

  const [row] = await db
    .insert(schema.ledgerEntries)
    .values({
      kind: entry.kind,
      amountCents: entry.amountCents,
      brandId: entry.brandId ?? null,
      contractorUserId: entry.contractorUserId ?? null,
      invoiceId: entry.invoiceId ?? null,
      payoutId: entry.payoutId ?? null,
      description: entry.description ?? null,
      stripeEventId: entry.stripeEventId ?? null,
      occurredAt: entry.occurredAt ?? new Date(),
    })
    .returning({ id: schema.ledgerEntries.id });

  return { inserted: true, id: row?.id };
}
