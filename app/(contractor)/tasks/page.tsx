import Link from 'next/link';
import { requireAuth } from '@/lib/auth/rbac';
import { listContractorTasks } from '@/lib/contractor/tasks';
import { formatCents, formatDate } from '@/lib/format';
import { PRICING } from '@/lib/pricing';
import type { DeliverableStatus, DeliverableType } from '@/lib/deliverables/types';

type SearchParams = Promise<{ status?: string; type?: string; brand?: string }>;

const STATUS_CHOICES = [
  ['todo', 'To do'],
  ['in_progress', 'In progress'],
  ['in_review', 'In review'],
  ['done', 'Done'],
  ['rejected', 'Rejected'],
] as const;

export default async function ContractorTasksPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const actor = await requireAuth();
  const sp = await searchParams;
  const statusFilter = sp.status
    ? (sp.status.split(',') as DeliverableStatus[])
    : (['todo', 'in_progress', 'in_review'] as DeliverableStatus[]);
  const type = sp.type ? (sp.type as DeliverableType) : null;

  const rows = await listContractorTasks(actor.userId, {
    status: statusFilter,
    type,
    brandId: sp.brand ?? null,
  });

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-6">
      <header>
        <p className="text-fg-3 text-xs uppercase tracking-[0.12em]">My work</p>
        <h1 className="text-fg-1 font-serif text-3xl italic">Tasks</h1>
      </header>

      <form method="get" className="flex flex-wrap gap-3 text-xs">
        <label className="flex flex-col gap-1">
          <span className="text-fg-3 uppercase tracking-[0.12em]">Status</span>
          <select
            name="status"
            defaultValue={statusFilter.join(',')}
            className="border-fg-4/20 bg-bg-2 text-fg-1 rounded-md border px-2 py-1"
          >
            <option value="todo,in_progress,in_review">Active</option>
            <option value="done">Done</option>
            <option value="rejected">Rejected</option>
            {STATUS_CHOICES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="bg-asaulia-blue text-fg-on-blue self-end rounded-md px-3 py-1.5"
        >
          Apply
        </button>
      </form>

      <section className="border-fg-4/15 bg-bg-1 rounded-2xl border p-5">
        {rows.length === 0 ? (
          <p className="text-fg-3 text-sm">No tasks match these filters.</p>
        ) : (
          <ul className="divide-fg-4/10 divide-y">
            {rows.map((r) => {
              const estimatedCents = estimateFixedShare(r.fixedShareBps, r.planFixedCents);
              const overdue =
                r.dueDate && new Date(`${r.dueDate}T23:59:59Z`) < new Date() && r.status !== 'done';
              return (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-fg-3 text-xs">{r.brandName}</div>
                    <Link
                      href={`/clients/${r.brandId}`}
                      className="text-fg-1 text-sm font-medium hover:underline"
                    >
                      {r.title}
                    </Link>
                    <div className="text-fg-3 mt-0.5 text-[11px] uppercase tracking-[0.1em]">
                      {r.type}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span
                      className={`rounded-full px-2 py-0.5 ${
                        r.status === 'done'
                          ? 'bg-asaulia-green/15 text-asaulia-green'
                          : r.status === 'in_review'
                            ? 'bg-warning/15 text-warning'
                            : 'bg-bg-2 text-fg-2'
                      }`}
                    >
                      {r.status.replace('_', ' ')}
                    </span>
                    {r.dueDate && (
                      <span
                        className={
                          overdue
                            ? 'text-asaulia-red'
                            : 'text-fg-3'
                        }
                      >
                        due {formatDate(r.dueDate)}
                      </span>
                    )}
                    <span
                      className="text-fg-2"
                      title={`fixed share ${(r.fixedShareBps / 100).toFixed(1)}% × brand fixed × ${PRICING.CONTRACTOR_SHARE_OF_FIXED_BPS / 100}%`}
                    >
                      est {formatCents(estimatedCents)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}

function estimateFixedShare(fixedShareBps: number, planFixedCents: number | null): number {
  if (!planFixedCents) return 0;
  return Math.round(
    (planFixedCents * PRICING.CONTRACTOR_SHARE_OF_FIXED_BPS * fixedShareBps) / 10_000 / 10_000,
  );
}
