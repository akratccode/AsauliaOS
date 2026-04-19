import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/rbac';
import { db, schema } from '@/lib/db';
import { formatCents, formatDate } from '@/lib/format';

export default async function ContractorEarningsHistoryPage() {
  const actor = await requireAuth();

  const rows = await db
    .select({
      id: schema.payouts.id,
      periodStart: schema.payouts.periodStart,
      periodEnd: schema.payouts.periodEnd,
      amountCents: schema.payouts.amountCents,
      status: schema.payouts.status,
      paidAt: schema.payouts.paidAt,
    })
    .from(schema.payouts)
    .where(eq(schema.payouts.contractorUserId, actor.userId))
    .orderBy(desc(schema.payouts.periodStart));

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-6">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-fg-3 text-xs uppercase tracking-[0.12em]">History</p>
          <h1 className="text-fg-1 font-serif text-3xl italic">Past payouts</h1>
        </div>
        <Link
          href="/earnings"
          className="text-fg-3 hover:text-fg-1 text-xs uppercase tracking-[0.12em]"
        >
          ← Current period
        </Link>
      </header>

      <section className="border-fg-4/15 bg-bg-1 rounded-2xl border p-5">
        {rows.length === 0 ? (
          <p className="text-fg-3 text-sm">
            No payouts yet. Your first payout will appear here after your first cycle closes.
          </p>
        ) : (
          <ul className="divide-fg-4/10 divide-y">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="text-fg-1 text-sm font-medium">
                    {formatDate(r.periodStart)} – {formatDate(r.periodEnd)}
                  </div>
                  <div className="text-fg-3 text-xs">
                    {r.paidAt ? `Paid ${formatDate(r.paidAt)}` : 'Awaiting payment'}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span
                    className={`rounded-full px-2 py-0.5 ${
                      r.status === 'paid'
                        ? 'bg-asaulia-green/15 text-asaulia-green'
                        : r.status === 'failed'
                          ? 'bg-asaulia-red/15 text-asaulia-red'
                          : 'bg-warning/15 text-warning'
                    }`}
                  >
                    {r.status}
                  </span>
                  <span className="text-fg-1 font-medium">
                    {formatCents(r.amountCents)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
