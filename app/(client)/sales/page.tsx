import { redirect } from 'next/navigation';
import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/rbac';
import { db, schema } from '@/lib/db';
import { resolveActiveBrand, requireClientBrandAccess } from '@/lib/brand/context';
import {
  customerHash,
  listIntegrationsForBrand,
  listSales,
  type SalesFilter,
} from '@/lib/sales/service';
import { formatCents, formatDate } from '@/lib/format';
import { resolveBillingWindow } from '@/lib/brand/billing-period';
import { Sparkline } from '@/components/charts/Sparkline';

type SearchParams = Promise<{
  integration?: string;
  attribution?: string;
  range?: string;
  page?: string;
}>;

const RANGE_PRESETS = {
  period: 'This period',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  all: 'All time',
} as const;

export default async function SalesPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const actor = await requireAuth();
  const { active } = await resolveActiveBrand(actor);
  if (!active) redirect('/onboarding/brand');
  await requireClientBrandAccess(actor, active.id);

  const [brand] = await db
    .select({ billingCycleDay: schema.brands.billingCycleDay })
    .from(schema.brands)
    .where(eq(schema.brands.id, active.id))
    .limit(1);

  const window = resolveBillingWindow(brand?.billingCycleDay ?? null);
  const range = (sp.range as keyof typeof RANGE_PRESETS) ?? 'period';

  const filter: SalesFilter = {
    brandId: active.id,
    integrationId: sp.integration ?? null,
    attribution:
      sp.attribution === 'attributed' || sp.attribution === 'unattributed'
        ? sp.attribution
        : 'all',
    page: Number(sp.page ?? 1) || 1,
    pageSize: 20,
  };

  const now = new Date();
  if (range === 'period') {
    filter.occurredFrom = window.start;
    filter.occurredTo = window.end;
  } else if (range === '30d') {
    filter.occurredFrom = new Date(now.getTime() - 30 * 86_400_000);
  } else if (range === '90d') {
    filter.occurredFrom = new Date(now.getTime() - 90 * 86_400_000);
  }

  const [integrations, list] = await Promise.all([
    listIntegrationsForBrand(active.id),
    listSales(filter),
  ]);

  const totalAttributedCents = list.rows
    .filter((r) => r.attributed)
    .reduce((acc, r) => acc + r.amountCents, 0);
  const avgOrderCents = list.rows.length
    ? Math.round(list.rows.reduce((a, r) => a + r.amountCents, 0) / list.rows.length)
    : 0;

  const csvHref = `/api/sales/export?${new URLSearchParams({
    ...(sp.integration ? { integration: sp.integration } : {}),
    ...(sp.attribution ? { attribution: sp.attribution } : {}),
    range,
  }).toString()}`;

  const pages = Math.max(1, Math.ceil(list.total / list.pageSize));

  // Daily bucket for the current view (visible rows only, order-of-magnitude preview).
  const dailyMap = new Map<string, number>();
  for (const r of list.rows.filter((r) => r.attributed)) {
    const key = r.occurredAt.toISOString().slice(0, 10);
    dailyMap.set(key, (dailyMap.get(key) ?? 0) + r.amountCents);
  }
  const dailyPoints = [...dailyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, cents]) => ({ date, cents }));

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-fg-3 text-xs uppercase tracking-[0.12em]">Transparency</p>
          <h1 className="text-fg-1 font-serif text-3xl italic">Sales</h1>
        </div>
        <a
          href={csvHref}
          className="border-fg-4/20 text-fg-2 hover:text-fg-1 rounded-md border px-3 py-1.5 text-xs"
        >
          Export CSV
        </a>
      </header>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Metric label="Attributed" value={formatCents(totalAttributedCents)} sub="in view" />
        <Metric label="Orders" value={String(list.total)} sub="matching filters" />
        <Metric
          label="Avg order"
          value={formatCents(avgOrderCents)}
          sub="on this page"
        />
        <Metric
          label="Integrations"
          value={String(integrations.length)}
          sub={integrations.length ? 'connected' : 'none connected'}
        />
      </section>

      <section className="border-fg-4/15 bg-bg-1 rounded-2xl border p-5">
        <div className="text-fg-3 mb-3 text-xs uppercase tracking-[0.12em]">
          Trend in view
        </div>
        <Sparkline data={dailyPoints} />
      </section>

      <section className="border-fg-4/15 bg-bg-1 rounded-2xl border p-5">
        <form className="mb-4 flex flex-wrap items-end gap-3 text-xs" method="get">
          <Field label="Range">
            <select
              name="range"
              defaultValue={range}
              className="border-fg-4/20 bg-bg-2 text-fg-1 rounded-md border px-2 py-1"
            >
              {Object.entries(RANGE_PRESETS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Integration">
            <select
              name="integration"
              defaultValue={sp.integration ?? ''}
              className="border-fg-4/20 bg-bg-2 text-fg-1 rounded-md border px-2 py-1"
            >
              <option value="">All</option>
              {integrations.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.displayName}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Attribution">
            <select
              name="attribution"
              defaultValue={sp.attribution ?? 'all'}
              className="border-fg-4/20 bg-bg-2 text-fg-1 rounded-md border px-2 py-1"
            >
              <option value="all">All</option>
              <option value="attributed">Attributed</option>
              <option value="unattributed">Unattributed</option>
            </select>
          </Field>
          <button
            type="submit"
            className="bg-asaulia-blue text-fg-on-blue rounded-md px-3 py-1.5 text-xs"
          >
            Apply
          </button>
        </form>

        {list.rows.length === 0 ? (
          <p className="text-fg-3 text-sm">No sales match these filters yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-fg-3 text-xs uppercase tracking-[0.12em]">
                <tr>
                  <th className="py-2">Date</th>
                  <th className="py-2">Source</th>
                  <th className="py-2 text-right">Amount</th>
                  <th className="py-2">Attribution</th>
                  <th className="py-2">Customer</th>
                </tr>
              </thead>
              <tbody className="divide-fg-4/10 divide-y">
                {list.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 text-fg-2">
                      {formatDate(r.occurredAt, {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-2 text-fg-2">{r.integrationName}</td>
                    <td className="py-2 text-right text-fg-1 font-medium">
                      {formatCents(r.amountCents, r.currency)}
                    </td>
                    <td className="py-2">
                      {r.attributed ? (
                        <span className="text-asaulia-green text-xs">
                          {r.attributionReason ?? 'attributed'}
                        </span>
                      ) : (
                        <span className="text-fg-3 text-xs">—</span>
                      )}
                    </td>
                    <td className="py-2 text-fg-3 text-xs font-mono">
                      {customerHash(r.externalId)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 && (
          <div className="text-fg-3 mt-4 flex items-center justify-between text-xs">
            <span>
              Page {list.page} of {pages}
            </span>
            <div className="flex gap-2">
              {list.page > 1 && (
                <Link
                  href={{
                    pathname: '/sales',
                    query: { ...sp, page: list.page - 1 },
                  }}
                  className="text-asaulia-blue-soft hover:underline"
                >
                  ← Prev
                </Link>
              )}
              {list.page < pages && (
                <Link
                  href={{ pathname: '/sales', query: { ...sp, page: list.page + 1 } }}
                  className="text-asaulia-blue-soft hover:underline"
                >
                  Next →
                </Link>
              )}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="border-fg-4/15 bg-bg-1 rounded-2xl border p-4">
      <div className="text-fg-3 text-[11px] uppercase tracking-[0.12em]">{label}</div>
      <div className="text-fg-1 mt-1 font-serif text-2xl italic">{value}</div>
      <div className="text-fg-3 mt-0.5 text-xs">{sub}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-fg-3 text-[10px] uppercase tracking-[0.12em]">{label}</span>
      {children}
    </label>
  );
}
