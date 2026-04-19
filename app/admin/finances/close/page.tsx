import { desc, sql } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';
import { requireAdmin } from '@/lib/auth/rbac';
import { db, schema } from '@/lib/db';
import { formatCents, formatDate } from '@/lib/format';
import { FINANCE_REGIONS, currencyForRegion, type FinanceRegion } from '@/lib/billing/region';
import { computeFinancePeriodTotalsBatch } from '@/app/actions/admin-finances';
import { ClosePeriodForm } from './close-period-form';

export async function generateMetadata() {
  const t = await getTranslations('admin.financesClose');
  return { title: t('metadata') };
}

type MonthKey = string;

export default async function AdminFinancesClosePage() {
  await requireAdmin();
  const t = await getTranslations('admin.financesClose');

  const now = new Date();
  const startY = now.getUTCFullYear();
  const startM = now.getUTCMonth() + 1;
  const earliest = new Date(Date.UTC(startY, startM - 12, 1));
  const earliestIso = `${earliest.getUTCFullYear()}-${String(earliest.getUTCMonth() + 1).padStart(2, '0')}-01`;

  const [closedRows, activityRows] = await Promise.all([
    db
      .select({
        id: schema.financePeriods.id,
        financeRegion: schema.financePeriods.financeRegion,
        currency: schema.financePeriods.currency,
        year: schema.financePeriods.year,
        month: schema.financePeriods.month,
        status: schema.financePeriods.status,
        revenueCents: schema.financePeriods.revenueCents,
        payoutsCents: schema.financePeriods.payoutsCents,
        bonusesCents: schema.financePeriods.bonusesCents,
        netCents: schema.financePeriods.netCents,
        closedAt: schema.financePeriods.closedAt,
      })
      .from(schema.financePeriods)
      .orderBy(desc(schema.financePeriods.year), desc(schema.financePeriods.month)),
    db
      .select({
        financeRegion: schema.invoices.financeRegion,
        year: sql<number>`extract(year from ${schema.invoices.periodEnd}::date)::int`,
        month: sql<number>`extract(month from ${schema.invoices.periodEnd}::date)::int`,
      })
      .from(schema.invoices)
      .where(sql`${schema.invoices.periodEnd} >= ${earliestIso}`)
      .groupBy(
        schema.invoices.financeRegion,
        sql`extract(year from ${schema.invoices.periodEnd}::date)`,
        sql`extract(month from ${schema.invoices.periodEnd}::date)`,
      ),
  ]);

  const closedByKey = new Map<string, (typeof closedRows)[number]>();
  for (const r of closedRows) {
    closedByKey.set(`${r.financeRegion}:${r.year}:${r.month}`, r);
  }

  const monthsByRegion = new Map<FinanceRegion, MonthKey[]>();
  for (const region of FINANCE_REGIONS) monthsByRegion.set(region, []);
  const seen = new Set<string>();
  for (const r of activityRows) {
    const key = `${r.financeRegion}:${r.year}:${r.month}`;
    if (seen.has(key)) continue;
    seen.add(key);
    monthsByRegion.get(r.financeRegion)?.push(`${r.year}:${r.month}`);
  }
  for (const r of closedRows) {
    const key = `${r.financeRegion}:${r.year}:${r.month}`;
    if (seen.has(key)) continue;
    seen.add(key);
    monthsByRegion.get(r.financeRegion)?.push(`${r.year}:${r.month}`);
  }

  for (const region of FINANCE_REGIONS) {
    const list = monthsByRegion.get(region) ?? [];
    list.sort((a, b) => {
      const pa = parseMonthKey(a);
      const pb = parseMonthKey(b);
      if (pb.year !== pa.year) return pb.year - pa.year;
      return pb.month - pa.month;
    });
    monthsByRegion.set(region, list);
  }

  const liveTotals = await computeFinancePeriodTotalsBatch(earliestIso);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <header>
        <p className="text-fg-3 text-xs uppercase tracking-[0.12em]">{t('moneyLabel')}</p>
        <h1 className="text-fg-1 font-serif text-3xl italic">{t('closeTitle')}</h1>
        <p className="text-fg-3 mt-1 max-w-2xl text-xs">{t('description')}</p>
      </header>

      {FINANCE_REGIONS.map((region) => {
        const months = monthsByRegion.get(region) ?? [];
        const currency = currencyForRegion(region);
        return (
          <section
            key={region}
            className="border-fg-4/15 bg-bg-1 overflow-x-auto rounded-2xl border"
          >
            <div className="border-fg-4/10 flex items-center justify-between border-b px-4 py-2 text-xs">
              <h2 className="text-fg-1 font-serif text-sm italic">
                {region === 'co' ? t('regionCo') : t('regionUs')}
              </h2>
            </div>
            <table className="w-full min-w-[820px] text-xs">
              <thead className="text-fg-3 uppercase tracking-[0.1em]">
                <tr>
                  <th className="px-3 py-2 text-left">{t('year')}</th>
                  <th className="px-3 py-2 text-left">{t('month')}</th>
                  <th className="px-3 py-2 text-right">{t('revenue')}</th>
                  <th className="px-3 py-2 text-right">{t('payouts')}</th>
                  <th className="px-3 py-2 text-right">{t('bonuses')}</th>
                  <th className="px-3 py-2 text-right">{t('net')}</th>
                  <th className="px-3 py-2 text-left">{t('status')}</th>
                  <th className="px-3 py-2 text-right" />
                </tr>
              </thead>
              <tbody>
                {months.length === 0 ? (
                  <tr>
                    <td className="text-fg-3 px-3 py-4" colSpan={8}>
                      {t('noPeriods')}
                    </td>
                  </tr>
                ) : (
                  months.map((mk) => {
                    const { year, month } = parseMonthKey(mk);
                    const key = `${region}:${year}:${month}`;
                    const closed = closedByKey.get(key);
                    const totals = closed
                      ? {
                          revenueCents: closed.revenueCents,
                          payoutsCents: closed.payoutsCents,
                          bonusesCents: closed.bonusesCents,
                          netCents: closed.netCents,
                        }
                      : liveTotals.get(key) ?? {
                          revenueCents: 0,
                          payoutsCents: 0,
                          bonusesCents: 0,
                          netCents: 0,
                        };
                    const status: 'open' | 'closed' = closed?.status === 'closed' ? 'closed' : 'open';
                    return (
                      <tr key={key} className="border-fg-4/10 border-t">
                        <td className="text-fg-2 px-3 py-2">{year}</td>
                        <td className="text-fg-2 px-3 py-2">{String(month).padStart(2, '0')}</td>
                        <td className="text-fg-1 px-3 py-2 text-right">
                          {formatCents(totals.revenueCents, currency)}
                        </td>
                        <td className="text-fg-2 px-3 py-2 text-right">
                          {formatCents(totals.payoutsCents, currency)}
                        </td>
                        <td className="text-fg-2 px-3 py-2 text-right">
                          {formatCents(totals.bonusesCents, currency)}
                        </td>
                        <td className="text-fg-1 px-3 py-2 text-right font-medium">
                          {formatCents(totals.netCents, currency)}
                        </td>
                        <td className="px-3 py-2">
                          <StatusPill
                            status={status}
                            label={status === 'closed' ? t('statusClosed') : t('statusOpen')}
                          />
                          {closed?.closedAt ? (
                            <div className="text-fg-3 mt-0.5 text-[10px]">
                              {t('closedOn', { date: formatDate(closed.closedAt) })}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex justify-end">
                            <ClosePeriodForm
                              financeRegion={region}
                              year={year}
                              month={month}
                              status={status}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </section>
        );
      })}
    </main>
  );
}

function parseMonthKey(mk: string): { year: number; month: number } {
  const parts = mk.split(':');
  return { year: Number(parts[0]), month: Number(parts[1]) };
}

function StatusPill({ status, label }: { status: 'open' | 'closed'; label: string }) {
  const tone =
    status === 'closed'
      ? 'bg-asaulia-green/15 text-asaulia-green'
      : 'bg-warning/15 text-warning';
  return <span className={`rounded-full px-2 py-0.5 text-[11px] ${tone}`}>{label}</span>;
}
