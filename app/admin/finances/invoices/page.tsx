import Link from 'next/link';
import { and, desc, eq, gte, inArray, lt } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';
import { db, schema } from '@/lib/db';
import { formatCents, formatDate } from '@/lib/format';
import { isFinanceRegion } from '@/lib/billing/region';
import { MarkInvoicePaidForm } from './mark-invoice-paid-form';

export async function generateMetadata() {
  const t = await getTranslations('admin.financesInvoices');
  return { title: t('metadata') };
}

type SearchParams = Promise<{
  filter?: string;
  status?: string;
  q?: string;
  region?: string;
}>;

export default async function AdminAllInvoicesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const t = await getTranslations('admin.financesInvoices');
  const sp = await searchParams;
  const filter = sp.filter ?? 'all';
  const regionFilter = isFinanceRegion(sp.region) ? sp.region : undefined;

  const conditions = [];
  if (sp.status) {
    conditions.push(
      eq(schema.invoices.status, sp.status as 'draft' | 'open' | 'paid' | 'failed' | 'void'),
    );
  }
  if (regionFilter) {
    conditions.push(eq(schema.invoices.financeRegion, regionFilter));
  }

  const now = new Date();
  const today = ymd(now);
  const monthStart = ymd(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));

  if (filter === 'past_due') {
    conditions.push(inArray(schema.invoices.status, ['open', 'failed']));
    conditions.push(lt(schema.invoices.periodEnd, today));
  } else if (filter === 'this_month') {
    conditions.push(gte(schema.invoices.periodStart, monthStart));
  } else if (filter === 'failed') {
    conditions.push(eq(schema.invoices.status, 'failed'));
  }

  const rows = await db
    .select({
      id: schema.invoices.id,
      brandId: schema.invoices.brandId,
      brandName: schema.brands.name,
      periodStart: schema.invoices.periodStart,
      periodEnd: schema.invoices.periodEnd,
      fixed: schema.invoices.fixedAmountCents,
      variable: schema.invoices.variableAmountCents,
      total: schema.invoices.totalAmountCents,
      currency: schema.invoices.currency,
      financeRegion: schema.invoices.financeRegion,
      status: schema.invoices.status,
      stripeInvoiceId: schema.invoices.stripeInvoiceId,
      paidAt: schema.invoices.paidAt,
      paymentMethod: schema.brands.paymentMethod,
    })
    .from(schema.invoices)
    .innerJoin(schema.brands, eq(schema.brands.id, schema.invoices.brandId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(schema.invoices.periodEnd))
    .limit(500);

  const filtered = sp.q
    ? rows.filter((r) => r.brandName.toLowerCase().includes(sp.q!.toLowerCase()))
    : rows;

  const totalCents = filtered.reduce((acc, r) => acc + (r.total ?? 0), 0);
  const paidCents = filtered
    .filter((r) => r.status === 'paid')
    .reduce((acc, r) => acc + (r.total ?? 0), 0);
  const displayCurrency = filtered[0]?.currency ?? 'USD';

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 p-6">
      <header>
        <p className="text-fg-3 text-xs uppercase tracking-[0.12em]">{t('moneyLabel')}</p>
        <h1 className="text-fg-1 font-serif text-3xl italic">{t('invoicesTitle')}</h1>
        <p className="text-fg-3 mt-1 text-xs">
          {t('summary', {
            count: filtered.length,
            billed: formatCents(totalCents, displayCurrency),
            collected: formatCents(paidCents, displayCurrency),
          })}
        </p>
      </header>

      <nav className="flex flex-wrap gap-2 text-xs">
        <FilterLink label={t('filterAll')} value="all" active={filter} region={regionFilter} />
        <FilterLink
          label={t('filterThisMonth')}
          value="this_month"
          active={filter}
          region={regionFilter}
        />
        <FilterLink
          label={t('filterPastDue')}
          value="past_due"
          active={filter}
          region={regionFilter}
        />
        <FilterLink
          label={t('filterFailed')}
          value="failed"
          active={filter}
          region={regionFilter}
        />
      </nav>

      <form method="get" className="flex flex-wrap gap-3 text-xs">
        <input type="hidden" name="filter" value={filter} />
        <input
          name="q"
          defaultValue={sp.q ?? ''}
          placeholder={t('searchPlaceholder')}
          className="border-fg-4/20 bg-bg-2 text-fg-1 rounded-md border px-3 py-1.5"
        />
        <select
          name="status"
          defaultValue={sp.status ?? ''}
          className="border-fg-4/20 bg-bg-2 text-fg-1 rounded-md border px-2 py-1.5"
        >
          <option value="">{t('anyStatus')}</option>
          <option value="draft">{t('statusDraft')}</option>
          <option value="open">{t('statusOpen')}</option>
          <option value="paid">{t('statusPaid')}</option>
          <option value="failed">{t('statusFailed')}</option>
          <option value="void">{t('statusVoid')}</option>
        </select>
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
        <table className="w-full min-w-[960px] text-xs">
          <thead className="text-fg-3 uppercase tracking-[0.1em]">
            <tr>
              <th className="px-3 py-2 text-left">{t('brand')}</th>
              <th className="px-3 py-2 text-left">{t('region')}</th>
              <th className="px-3 py-2 text-left">{t('period')}</th>
              <th className="px-3 py-2 text-left">{t('status')}</th>
              <th className="px-3 py-2 text-right">{t('fixed')}</th>
              <th className="px-3 py-2 text-right">{t('variable')}</th>
              <th className="px-3 py-2 text-right">{t('total')}</th>
              <th className="px-3 py-2 text-left">{t('stripe')}</th>
              <th className="px-3 py-2 text-right">{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td className="text-fg-3 px-3 py-4" colSpan={9}>
                  {t('noInvoices')}
                </td>
              </tr>
            ) : (
              filtered.map((r) => {
                const canMark = r.paymentMethod === 'manual' && r.status !== 'paid';
                return (
                  <tr key={r.id} className="border-fg-4/10 border-t">
                    <td className="px-3 py-2">
                      <Link
                        href={`/admin/brands/${r.brandId}/invoices`}
                        className="text-fg-1 hover:underline"
                      >
                        {r.brandName}
                      </Link>
                    </td>
                    <td className="text-fg-3 px-3 py-2 uppercase">{r.financeRegion}</td>
                    <td className="text-fg-3 px-3 py-2">
                      {formatDate(r.periodStart)} – {formatDate(r.periodEnd)}
                    </td>
                    <td className="px-3 py-2">
                      <StatusPill status={r.status} />
                    </td>
                    <td className="text-fg-2 px-3 py-2 text-right">
                      {formatCents(r.fixed, r.currency)}
                    </td>
                    <td className="text-fg-2 px-3 py-2 text-right">
                      {formatCents(r.variable, r.currency)}
                    </td>
                    <td className="text-fg-1 px-3 py-2 text-right font-medium">
                      {formatCents(r.total ?? 0, r.currency)}
                    </td>
                    <td className="text-fg-3 px-3 py-2 font-mono">
                      {r.stripeInvoiceId ? r.stripeInvoiceId.slice(0, 14) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {canMark ? <MarkInvoicePaidForm invoiceId={r.id} /> : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}

function FilterLink({
  label,
  value,
  active,
  region,
}: {
  label: string;
  value: string;
  active: string;
  region: 'us' | 'co' | undefined;
}) {
  const isActive = active === value;
  const params = new URLSearchParams();
  params.set('filter', value);
  if (region) params.set('region', region);
  return (
    <Link
      href={`/admin/finances/invoices?${params.toString()}`}
      className={`rounded-full px-3 py-1 ${
        isActive ? 'bg-fg-1 text-bg-1' : 'bg-bg-2 text-fg-2 hover:text-fg-1'
      }`}
    >
      {label}
    </Link>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === 'paid'
      ? 'bg-asaulia-green/15 text-asaulia-green'
      : status === 'failed'
        ? 'bg-asaulia-red/15 text-asaulia-red'
        : status === 'open'
          ? 'bg-warning/15 text-warning'
          : 'bg-bg-2 text-fg-2';
  return <span className={`rounded-full px-2 py-0.5 ${tone}`}>{status}</span>;
}

function ymd(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
