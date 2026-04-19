import { desc, inArray } from 'drizzle-orm';
import Link from 'next/link';
import { db, schema } from '@/lib/db';
import { formatCents, formatDate } from '@/lib/format';

export default async function AdminPayoutsQueuePage() {
  const rows = await db
    .select({
      id: schema.payouts.id,
      contractorUserId: schema.payouts.contractorUserId,
      periodStart: schema.payouts.periodStart,
      periodEnd: schema.payouts.periodEnd,
      amount: schema.payouts.amountCents,
      status: schema.payouts.status,
      stripeTransferId: schema.payouts.stripeTransferId,
    })
    .from(schema.payouts)
    .where(inArray(schema.payouts.status, ['pending', 'processing', 'failed']))
    .orderBy(desc(schema.payouts.periodEnd))
    .limit(200);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <header>
        <p className="text-fg-3 text-xs uppercase tracking-[0.12em]">Money</p>
        <h1 className="text-fg-1 font-serif text-3xl italic">Payouts queue</h1>
        <p className="text-fg-3 mt-1 text-xs">
          Bulk &quot;Send all pending&quot; ships with the Phase 11 payout job; queue view is
          read-only for now.
        </p>
      </header>

      <section className="border-fg-4/15 bg-bg-1 overflow-x-auto rounded-2xl border">
        <table className="w-full min-w-[720px] text-xs">
          <thead className="text-fg-3 uppercase tracking-[0.1em]">
            <tr>
              <th className="px-3 py-2 text-left">Contractor</th>
              <th className="px-3 py-2 text-left">Period</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Transfer</th>
              <th className="px-3 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="text-fg-3 px-3 py-4" colSpan={5}>
                  Queue is empty.
                </td>
              </tr>
            ) : (
              rows.map((p) => (
                <tr key={p.id} className="border-fg-4/10 border-t">
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/contractors/${p.contractorUserId}`}
                      className="text-fg-1 font-mono hover:underline"
                    >
                      {p.contractorUserId.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="text-fg-3 px-3 py-2">
                    {formatDate(p.periodStart)} – {formatDate(p.periodEnd)}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 ${
                        p.status === 'failed'
                          ? 'bg-asaulia-red/15 text-asaulia-red'
                          : p.status === 'processing'
                            ? 'bg-warning/15 text-warning'
                            : 'bg-bg-2 text-fg-2'
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="text-fg-3 px-3 py-2 font-mono">
                    {p.stripeTransferId ?? '—'}
                  </td>
                  <td className="text-fg-1 px-3 py-2 text-right">
                    {formatCents(p.amount)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
