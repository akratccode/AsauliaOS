import Link from 'next/link';
import { requireAuth } from '@/lib/auth/rbac';
import { resolveBillingWindow } from '@/lib/brand/billing-period';
import { projectEarningsForPeriod } from '@/lib/contractor/earnings';
import { formatCents, formatBps, formatDate } from '@/lib/format';

const PAYOUT_BUFFER_DAYS = 5;

export default async function ContractorEarningsPage() {
  const actor = await requireAuth();
  const window = resolveBillingWindow(null);
  const projection = await projectEarningsForPeriod(actor.userId, {
    start: window.start,
    end: window.end,
  });

  const nextPayoutDate = new Date(window.end.getTime() + PAYOUT_BUFFER_DAYS * 86_400_000);
  const total = projection.totalCents;
  const fixedPct = total > 0 ? Math.round((projection.fixedTotalCents / total) * 100) : 0;
  const variablePct = total > 0 ? 100 - fixedPct : 0;

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-6">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-fg-3 text-xs uppercase tracking-[0.12em]">Compensation</p>
          <h1 className="text-fg-1 font-serif text-3xl italic">Earnings</h1>
        </div>
        <Link
          href="/earnings/history"
          className="text-fg-3 hover:text-fg-1 text-xs uppercase tracking-[0.12em]"
        >
          Past payouts →
        </Link>
      </header>

      <section className="border-fg-4/15 bg-bg-1 grid gap-4 rounded-2xl border p-5 md:grid-cols-3">
        <div>
          <p className="text-fg-3 text-xs uppercase tracking-[0.12em]">Projected this period</p>
          <p className="text-fg-1 mt-1 font-serif text-3xl italic">{formatCents(total)}</p>
          <p className="text-fg-3 mt-2 text-xs">Period · {window.label}</p>
        </div>
        <div>
          <p className="text-fg-3 text-xs uppercase tracking-[0.12em]">Fixed</p>
          <p className="text-fg-1 mt-1 font-serif text-xl italic">
            {formatCents(projection.fixedTotalCents)}
          </p>
          <p className="text-fg-3 mt-1 text-xs">{fixedPct}% of projected</p>
        </div>
        <div>
          <p className="text-fg-3 text-xs uppercase tracking-[0.12em]">Variable</p>
          <p className="text-fg-1 mt-1 font-serif text-xl italic">
            {formatCents(projection.variableTotalCents)}
          </p>
          <p className="text-fg-3 mt-1 text-xs">{variablePct}% · based on attributed sales so far</p>
        </div>
      </section>

      <section>
        <h2 className="text-fg-1 mb-3 font-serif text-lg italic">By brand</h2>
        {projection.byBrand.length === 0 ? (
          <p className="text-fg-3 text-sm">No active brand assignments this period.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {projection.byBrand.map((b) => {
              const share = total > 0 ? Math.round((b.totalCents / total) * 100) : 0;
              return (
                <Link
                  key={b.brandId}
                  href={`/clients/${b.brandId}`}
                  className="border-fg-4/15 bg-bg-1 hover:border-asaulia-blue/40 block rounded-2xl border p-5"
                >
                  <div className="flex items-start justify-between">
                    <div className="text-fg-1 font-serif text-lg italic">{b.brandName}</div>
                    <div className="text-fg-3 text-xs">{share}% of pool</div>
                  </div>
                  <div className="text-fg-1 mt-2 font-serif text-2xl italic">
                    {formatCents(b.totalCents)}
                  </div>
                  <dl className="text-fg-3 mt-3 grid grid-cols-2 gap-1 text-xs">
                    <dt>Fixed</dt>
                    <dd className="text-fg-2 text-right">
                      {formatCents(b.myFixedShareCents)}
                    </dd>
                    <dt>Variable</dt>
                    <dd className="text-fg-2 text-right">
                      {formatCents(b.myVariableShareCents)}
                    </dd>
                    <dt>Deliverables contributing</dt>
                    <dd className="text-fg-2 text-right">
                      {b.contributingDeliverableIds.length}
                    </dd>
                    <dt>Attributed sales</dt>
                    <dd className="text-fg-2 text-right">
                      {formatCents(b.attributedSalesCents)}
                    </dd>
                    {b.plan && (
                      <>
                        <dt>Plan</dt>
                        <dd className="text-fg-2 text-right">
                          {formatCents(b.plan.fixedAmountCents)} +{' '}
                          {formatBps(b.plan.variablePercentBps)}
                        </dd>
                      </>
                    )}
                  </dl>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="border-fg-4/15 bg-bg-1 rounded-2xl border p-5">
        <p className="text-fg-3 text-xs uppercase tracking-[0.12em]">Next payout</p>
        <p className="text-fg-1 mt-1 font-serif text-2xl italic">{formatDate(nextPayoutDate)}</p>
        <p className="text-fg-3 mt-2 text-xs">
          Amount locks in at cycle close ({formatDate(window.end)}) and pays{' '}
          {PAYOUT_BUFFER_DAYS} days after reconciliation. Projection above is indicative.
        </p>
      </section>
    </main>
  );
}
