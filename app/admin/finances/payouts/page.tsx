import { and, desc, eq, inArray } from 'drizzle-orm';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { db, schema } from '@/lib/db';
import { formatCents, formatDate } from '@/lib/format';
import { isFinanceRegion } from '@/lib/billing/region';
import { MarkPayoutPaidForm } from './mark-payout-paid-form';

export async function generateMetadata() {
  const t = await getTranslations('admin.financesPayouts');
  return { title: t('metadata') };
}

type SearchParams = Promise<{ region?: string }>;

export default async function AdminPayoutsQueuePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const t = await getTranslations('admin.financesPayouts');
  const sp = await searchParams;
  const regionFilter = isFinanceRegion(sp.region) ? sp.region : undefined;

  const conditions = [inArray(schema.payouts.status, ['pending', 'processing', 'failed'])];
  if (regionFilter) conditions.push(eq(schema.payouts.financeRegion, regionFilter));

  const rows = await db
    .select({
      id: schema.payouts.id,
      contractorUserId: schema.payouts.contractorUserId,
      periodStart: schema.payouts.periodStart,
      periodEnd: schema.payouts.periodEnd,
      amount: schema.payouts.amountCents,
      currency: schema.payouts.currency,
      financeRegion: schema.payouts.financeRegion,
      status: schema.payouts.status,
      stripeTransferId: schema.payouts.stripeTransferId,
    })
    .from(schema.payouts)
    .where(and(...conditions))
    .orderBy(desc(schema.payouts.periodEnd))
    .limit(200);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <header>
        <p className="text-fg-3 text-xs uppercase tracking-[0.12em]">{t('moneyLabel')}</p>
        <h1 className="text-fg-1 font-serif text-3xl italic">{t('payoutsTitle')}</h1>
        <p className="text-fg-3 mt-1 max-w-2xl text-xs">{t('description')}</p>
      </header>

      <form method="get" className="flex flex-wrap gap-3 text-xs">
        <select
          name="region"
          defaultValue={regionFilter ?? ''}
          className="border-fg-4/20 bg-bg-2 text-fg-1 rounded-md border px-2 py-1.5"
        >
          <option value="">{t('anyRegion')}</option>
          <option value="us">{t('regionUs')}</option>
          <option value="co">{t('regionCo')}</option>
        </select>
        <button
          type="submit"
          className="bg-asaulia-blue text-fg-on-blue rounded-md px-3 py-1.5"
        >
          {t('filter')}
        </button>
      </form>

      <section className="border-fg-4/15 bg-bg-1 overflow-x-auto rounded-2xl border">
        <table className="w-full min-w-[860px] text-xs">
          <thead className="text-fg-3 uppercase tracking-[0.1em]">
            <tr>
              <th className="px-3 py-2 text-left">{t('contractor')}</th>
              <th className="px-3 py-2 text-left">{t('region')}</th>
              <th className="px-3 py-2 text-left">{t('period')}</th>
              <th className="px-3 py-2 text-left">{t('status')}</th>
              <th className="px-3 py-2 text-left">{t('transfer')}</th>
              <th className="px-3 py-2 text-right">{t('amount')}</th>
              <th className="px-3 py-2 text-right">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="text-fg-3 px-3 py-4" colSpan={7}>
                  {t('queueEmpty')}
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
                  <td className="text-fg-3 px-3 py-2 uppercase">{p.financeRegion}</td>
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
                    {formatCents(p.amount, p.currency)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {p.financeRegion === 'co' && p.status !== 'paid' ? (
                      <MarkPayoutPaidForm payoutId={p.id} />
                    ) : null}
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
