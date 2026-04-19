import Link from 'next/link';
import { and, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';
import { db, schema } from '@/lib/db';
import { PRICING } from '@/lib/pricing/constants';
import { formatCents, formatDate } from '@/lib/format';

export async function generateMetadata() {
  const t = await getTranslations('admin.finances');
  return { title: t('metadata') };
}

export default async function AdminFinancesPage() {
  const t = await getTranslations('admin.finances');
  const now = new Date();
  const twelveMonthsAgo = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1),
  );

  const monthly = await db
    .select({
      month: sql<string>`to_char(date_trunc('month', ${schema.invoices.periodStart}::date), 'YYYY-MM-01')`,
      fixed: sql<number>`coalesce(sum(${schema.invoices.fixedAmountCents}), 0)::int`,
      variable: sql<number>`coalesce(sum(${schema.invoices.variableAmountCents}), 0)::int`,
    })
    .from(schema.invoices)
    .where(
      and(
        inArray(schema.invoices.status, ['paid', 'open']),
        gte(schema.invoices.periodStart, ymd(twelveMonthsAgo)),
      ),
    )
    .groupBy(sql`date_trunc('month', ${schema.invoices.periodStart}::date)`)
    .orderBy(sql`date_trunc('month', ${schema.invoices.periodStart}::date)`);

  const pastDue = await db
    .select({
      id: schema.invoices.id,
      brandId: schema.invoices.brandId,
      brandName: schema.brands.name,
      total: schema.invoices.totalAmountCents,
      issuedAt: schema.invoices.issuedAt,
      periodEnd: schema.invoices.periodEnd,
    })
    .from(schema.invoices)
    .innerJoin(schema.brands, eq(schema.brands.id, schema.invoices.brandId))
    .where(
      and(
        inArray(schema.invoices.status, ['failed', 'open']),
        lt(schema.invoices.periodEnd, ymd(now)),
      ),
    )
    .orderBy(desc(schema.invoices.periodEnd))
    .limit(50);

  const upcomingPayouts = await db
    .select({
      id: schema.payouts.id,
      contractorUserId: schema.payouts.contractorUserId,
      amount: schema.payouts.amountCents,
      periodEnd: schema.payouts.periodEnd,
      status: schema.payouts.status,
    })
    .from(schema.payouts)
    .where(inArray(schema.payouts.status, ['pending', 'processing']))
    .orderBy(schema.payouts.periodEnd)
    .limit(25);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <header>
        <p className="text-fg-3 text-xs uppercase tracking-[0.12em]">{t('moneyLabel')}</p>
        <h1 className="text-fg-1 font-serif text-3xl italic">{t('financesTitle')}</h1>
      </header>

      <section className="border-fg-4/15 bg-bg-1 overflow-x-auto rounded-2xl border">
        <table className="w-full min-w-[720px] text-xs">
          <thead className="text-fg-3 uppercase tracking-[0.1em]">
            <tr>
              <th className="px-3 py-2 text-left">{t('month')}</th>
              <th className="px-3 py-2 text-right">{t('revenue')}</th>
              <th className="px-3 py-2 text-right">{t('contractorPool')}</th>
              <th className="px-3 py-2 text-right">{t('asauliaMargin')}</th>
              <th className="px-3 py-2 text-right">{t('marginPercent')}</th>
            </tr>
          </thead>
          <tbody>
            {monthly.length === 0 ? (
              <tr>
                <td className="text-fg-3 px-3 py-4" colSpan={5}>
                  {t('noPaidInvoices')}
                </td>
              </tr>
            ) : (
              monthly.map((m) => {
                const revenue = m.fixed + m.variable;
                const pool =
                  Math.floor((m.fixed * PRICING.CONTRACTOR_SHARE_OF_FIXED_BPS) / 10_000) +
                  Math.floor((m.variable * PRICING.CONTRACTOR_SHARE_OF_VARIABLE_BPS) / 10_000);
                const margin = revenue - pool;
                const marginPct = revenue > 0 ? Math.round((margin / revenue) * 100) : 0;
                return (
                  <tr key={m.month} className="border-fg-4/10 border-t">
                    <td className="text-fg-2 px-3 py-2">{m.month.slice(0, 7)}</td>
                    <td className="text-fg-1 px-3 py-2 text-right">{formatCents(revenue)}</td>
                    <td className="text-fg-2 px-3 py-2 text-right">{formatCents(pool)}</td>
                    <td className="text-fg-1 px-3 py-2 text-right">{formatCents(margin)}</td>
                    <td className="text-fg-3 px-3 py-2 text-right">{marginPct}%</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>

      <section className="border-fg-4/15 bg-bg-1 rounded-2xl border p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-fg-1 font-serif text-lg italic">{t('pastDueInvoices')}</h2>
          <Link
            href="/admin/finances/invoices"
            className="text-fg-3 hover:text-fg-1 text-xs"
          >
            {t('allInvoices')}
          </Link>
        </div>
        {pastDue.length === 0 ? (
          <p className="text-fg-3 text-sm">{t('cleanBooks')}</p>
        ) : (
          <ul className="divide-fg-4/10 divide-y text-xs">
            {pastDue.map((i) => (
              <li key={i.id} className="flex items-center justify-between py-2">
                <Link
                  href={`/admin/brands/${i.brandId}/invoices`}
                  className="text-fg-1 hover:underline"
                >
                  {i.brandName}
                </Link>
                <span className="text-fg-3">
                  {t('periodEnded', { date: formatDate(i.periodEnd) })}
                </span>
                <span className="text-fg-1 font-medium">
                  {formatCents(i.total ?? 0)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border-fg-4/15 bg-bg-1 rounded-2xl border p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-fg-1 font-serif text-lg italic">{t('upcomingPayouts')}</h2>
          <Link href="/admin/finances/payouts" className="text-fg-3 hover:text-fg-1 text-xs">
            {t('payoutQueue')}
          </Link>
        </div>
        {upcomingPayouts.length === 0 ? (
          <p className="text-fg-3 text-sm">{t('queueEmpty')}</p>
        ) : (
          <ul className="divide-fg-4/10 divide-y text-xs">
            {upcomingPayouts.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2">
                <Link
                  href={`/admin/contractors/${p.contractorUserId}`}
                  className="text-fg-1 font-mono hover:underline"
                >
                  {p.contractorUserId.slice(0, 8)}
                </Link>
                <span className="text-fg-3">{p.status}</span>
                <span className="text-fg-3">{t('ends', { date: formatDate(p.periodEnd) })}</span>
                <span className="text-fg-1 font-medium">{formatCents(p.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function ymd(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
