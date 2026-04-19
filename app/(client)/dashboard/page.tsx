import { redirect } from 'next/navigation';
import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/rbac';
import { db, schema } from '@/lib/db';
import { resolveActiveBrand } from '@/lib/brand/context';
import { getDashboardData } from '@/lib/dashboard/service';
import { Sparkline } from '@/components/charts/Sparkline';
import { formatCents, formatRelative } from '@/lib/format';

export default async function DashboardPage() {
  const actor = await requireAuth();
  const { active } = await resolveActiveBrand(actor);
  if (!active) redirect('/onboarding/brand');

  const [brand] = await db
    .select({ billingCycleDay: schema.brands.billingCycleDay })
    .from(schema.brands)
    .where(eq(schema.brands.id, active.id))
    .limit(1);

  const stats = await getDashboardData(active.id, brand?.billingCycleDay ?? null);

  const progress =
    stats.deliverablesTotal > 0
      ? Math.round((stats.deliverablesDone / stats.deliverablesTotal) * 100)
      : 0;

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <header>
        <p className="text-fg-3 text-xs uppercase tracking-[0.12em]">Overview</p>
        <h1 className="text-fg-1 font-serif text-3xl italic">Dashboard</h1>
      </header>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Metric
          label="Days left in period"
          value={`${stats.window.daysLeft}`}
          sub={`of ${stats.window.totalDays} days`}
        />
        <Metric
          label="Deliverables"
          value={`${stats.deliverablesDone} / ${stats.deliverablesTotal}`}
          sub={`${progress}% complete`}
        />
        <Metric
          label="Attributed sales"
          value={formatCents(stats.attributedSalesCents)}
          sub={`${stats.attributedSalesCount} orders`}
        />
        <Metric
          label="Projected invoice"
          value={formatCents(stats.projectedInvoiceCents)}
          sub={stats.plan ? `fixed + variable` : 'pick a plan'}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="border-fg-4/15 bg-bg-1 rounded-2xl border p-5 md:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-fg-3 text-xs uppercase tracking-[0.12em]">Sales</div>
              <div className="text-fg-1 font-serif text-lg italic">Daily attributed</div>
            </div>
            <Link href="/sales" className="text-asaulia-blue-soft text-xs hover:underline">
              View all
            </Link>
          </div>
          <Sparkline data={stats.dailySales} />
        </div>

        <div className="border-fg-4/15 bg-bg-1 rounded-2xl border p-5">
          <div className="text-fg-3 text-xs uppercase tracking-[0.12em]">Deliverables</div>
          <div className="text-fg-1 mb-2 font-serif text-lg italic">Pipeline</div>
          <ul className="space-y-1 text-sm">
            {(
              [
                ['todo', 'To do'],
                ['in_progress', 'In progress'],
                ['in_review', 'In review'],
                ['done', 'Done'],
                ['rejected', 'Rejected'],
              ] as const
            ).map(([key, label]) => (
              <li key={key} className="flex items-center justify-between">
                <span className="text-fg-2">{label}</span>
                <span className="text-fg-1 font-medium">
                  {stats.deliverablesByStatus[key]}
                </span>
              </li>
            ))}
          </ul>
          <Link
            href="/deliverables"
            className="text-asaulia-blue-soft mt-4 block text-xs hover:underline"
          >
            Open board →
          </Link>
        </div>
      </section>

      <section className="border-fg-4/15 bg-bg-1 rounded-2xl border p-5">
        <div className="text-fg-3 text-xs uppercase tracking-[0.12em]">Recent activity</div>
        {stats.recentActivity.length === 0 ? (
          <p className="text-fg-3 mt-2 text-sm">
            Your team will start delivering within 48 hours.
          </p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {stats.recentActivity.map((item) => (
              <li key={item.id} className="flex items-center justify-between">
                <Link
                  href={item.deliverableId ? `/deliverables?open=${item.deliverableId}` : '/deliverables'}
                  className="text-fg-2 hover:text-fg-1"
                >
                  {item.message}
                </Link>
                <span className="text-fg-3 text-xs">{formatRelative(item.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function Metric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="border-fg-4/15 bg-bg-1 rounded-2xl border p-4">
      <div className="text-fg-3 text-[11px] uppercase tracking-[0.12em]">{label}</div>
      <div className="text-fg-1 mt-1 font-serif text-2xl italic">{value}</div>
      <div className="text-fg-3 mt-0.5 text-xs">{sub}</div>
    </div>
  );
}
