import Link from 'next/link';
import { and, desc, eq, gte, inArray, lt } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { formatCents, formatDate } from '@/lib/format';

type SearchParams = Promise<{ filter?: string; status?: string; q?: string }>;

export default async function AdminAllInvoicesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const filter = sp.filter ?? 'all';

  const conditions = [];
  if (sp.status) {
    conditions.push(eq(schema.invoices.status, sp.status as 'draft' | 'open' | 'paid' | 'failed' | 'void'));
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
      status: schema.invoices.status,
      stripeInvoiceId: schema.invoices.stripeInvoiceId,
      paidAt: schema.invoices.paidAt,
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

  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 p-6">
      <header>
        <p className="text-fg-3 text-xs uppercase tracking-[0.12em]">Money</p>
        <h1 className="text-fg-1 font-serif text-3xl italic">Invoices</h1>
        <p className="text-fg-3 mt-1 text-xs">
          {filtered.length} invoices · {formatCents(totalCents)} billed · {formatCents(paidCents)} collected
        </p>
      </header>

      <nav className="flex flex-wrap gap-2 text-xs">
        <FilterLink label="All" value="all" active={filter} />
        <FilterLink label="This month" value="this_month" active={filter} />
        <FilterLink label="Past due" value="past_due" active={filter} />
        <FilterLink label="Failed" value="failed" active={filter} />
      </nav>

      <form method="get" className="flex flex-wrap gap-3 text-xs">
        <input type="hidden" name="filter" value={filter} />
        <input
          name="q"
          defaultValue={sp.q ?? ''}
          placeholder="Brand name"
          className="border-fg-4/20 bg-bg-2 text-fg-1 rounded-md border px-3 py-1.5"
        />
        <select
          name="status"
          defaultValue={sp.status ?? ''}
          className="border-fg-4/20 bg-bg-2 text-fg-1 rounded-md border px-2 py-1.5"
        >
          <option value="">Any status</option>
          <option value="draft">Draft</option>
          <option value="open">Open</option>
          <option value="paid">Paid</option>
          <option value="failed">Failed</option>
          <option value="void">Void</option>
        </select>
        <button
          type="submit"
          className="bg-asaulia-blue text-fg-on-blue rounded-md px-3 py-1.5"
        >
          Filter
        </button>
      </form>

      <section className="border-fg-4/15 bg-bg-1 overflow-x-auto rounded-2xl border">
        <table className="w-full min-w-[820px] text-xs">
          <thead className="text-fg-3 uppercase tracking-[0.1em]">
            <tr>
              <th className="px-3 py-2 text-left">Brand</th>
              <th className="px-3 py-2 text-left">Period</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Fixed</th>
              <th className="px-3 py-2 text-right">Variable</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-left">Stripe</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td className="text-fg-3 px-3 py-4" colSpan={7}>
                  No invoices match.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="border-fg-4/10 border-t">
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/brands/${r.brandId}/invoices`}
                      className="text-fg-1 hover:underline"
                    >
                      {r.brandName}
                    </Link>
                  </td>
                  <td className="text-fg-3 px-3 py-2">
                    {formatDate(r.periodStart)} – {formatDate(r.periodEnd)}
                  </td>
                  <td className="px-3 py-2">
                    <StatusPill status={r.status} />
                  </td>
                  <td className="text-fg-2 px-3 py-2 text-right">{formatCents(r.fixed)}</td>
                  <td className="text-fg-2 px-3 py-2 text-right">{formatCents(r.variable)}</td>
                  <td className="text-fg-1 px-3 py-2 text-right font-medium">
                    {formatCents(r.total ?? 0)}
                  </td>
                  <td className="text-fg-3 px-3 py-2 font-mono">
                    {r.stripeInvoiceId ? r.stripeInvoiceId.slice(0, 14) : '—'}
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

function FilterLink({
  label,
  value,
  active,
}: {
  label: string;
  value: string;
  active: string;
}) {
  const isActive = active === value;
  return (
    <Link
      href={`/admin/finances/invoices?filter=${value}`}
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
