import Link from 'next/link';
import { desc, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { formatCents, formatDate } from '@/lib/format';

type SearchParams = Promise<{ status?: string; q?: string }>;

export default async function AdminBrandsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const rows = await db
    .select({
      id: schema.brands.id,
      name: schema.brands.name,
      slug: schema.brands.slug,
      status: schema.brands.status,
      createdAt: schema.brands.createdAt,
      fixedAmountCents: schema.plans.fixedAmountCents,
      variablePercentBps: schema.plans.variablePercentBps,
    })
    .from(schema.brands)
    .leftJoin(
      schema.plans,
      sql`${schema.plans.brandId} = ${schema.brands.id} AND ${schema.plans.effectiveTo} IS NULL`,
    )
    .orderBy(desc(schema.brands.createdAt));

  const filtered = rows.filter((r) => {
    if (sp.status && r.status !== sp.status) return false;
    if (sp.q && !r.name.toLowerCase().includes(sp.q.toLowerCase())) return false;
    return true;
  });

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <header>
        <p className="text-fg-3 text-xs uppercase tracking-[0.12em]">Portfolio</p>
        <h1 className="text-fg-1 font-serif text-3xl italic">Brands</h1>
      </header>

      <form method="get" className="flex flex-wrap gap-3 text-xs">
        <input
          name="q"
          defaultValue={sp.q ?? ''}
          placeholder="Search by name"
          className="border-fg-4/20 bg-bg-2 text-fg-1 rounded-md border px-3 py-1.5"
        />
        <select
          name="status"
          defaultValue={sp.status ?? ''}
          className="border-fg-4/20 bg-bg-2 text-fg-1 rounded-md border px-2 py-1.5"
        >
          <option value="">All statuses</option>
          <option value="trial">Trial</option>
          <option value="active">Active</option>
          <option value="past_due">Past due</option>
          <option value="paused">Paused</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button
          type="submit"
          className="bg-asaulia-blue text-fg-on-blue rounded-md px-3 py-1.5"
        >
          Filter
        </button>
      </form>

      <section className="border-fg-4/15 bg-bg-1 overflow-x-auto rounded-2xl border">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-fg-4/10 text-fg-3 border-b text-xs uppercase tracking-[0.12em]">
              <th className="px-4 py-2 text-left">Brand</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-right">Plan</th>
              <th className="px-4 py-2 text-right">Signed up</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td className="text-fg-3 px-4 py-4" colSpan={4}>
                  No brands match.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr
                  key={r.id}
                  className="border-fg-4/10 hover:bg-bg-2 cursor-pointer border-b last:border-b-0"
                >
                  <td className="px-4 py-2">
                    <Link href={`/admin/brands/${r.id}`} className="text-fg-1 font-medium">
                      {r.name}
                    </Link>
                    <span className="text-fg-3 ml-2 font-mono text-[11px]">{r.slug}</span>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] ${
                        r.status === 'active'
                          ? 'bg-asaulia-green/15 text-asaulia-green'
                          : r.status === 'past_due' || r.status === 'cancelled'
                            ? 'bg-asaulia-red/15 text-asaulia-red'
                            : 'bg-bg-2 text-fg-2'
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="text-fg-2 px-4 py-2 text-right text-xs">
                    {r.fixedAmountCents != null
                      ? `${formatCents(r.fixedAmountCents)} + ${((r.variablePercentBps ?? 0) / 100).toFixed(1)}%`
                      : '—'}
                  </td>
                  <td className="text-fg-3 px-4 py-2 text-right text-xs">
                    {formatDate(r.createdAt)}
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

