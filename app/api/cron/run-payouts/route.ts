import { NextResponse } from 'next/server';
import { assertCronSecret, CronAuthError } from '@/lib/billing/cron';
import { findInvoicesDueForPayout, runPayoutsForInvoice } from '@/lib/billing/payout';

export async function POST(req: Request) {
  try {
    assertCronSecret(req);
  } catch (err) {
    if (err instanceof CronAuthError) {
      return NextResponse.json({ error: err.code }, { status: 401 });
    }
    throw err;
  }

  const now = new Date();
  const invoices = await findInvoicesDueForPayout({ now });

  const results: Array<{ invoiceId: string; perContractor: unknown; error?: string }> = [];
  for (const invoice of invoices) {
    try {
      const out = await runPayoutsForInvoice({ invoice, now });
      results.push({ invoiceId: invoice.id, perContractor: out.perContractor });
    } catch (err) {
      results.push({
        invoiceId: invoice.id,
        perContractor: null,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({ processed: invoices.length, results });
}

export const GET = POST;
