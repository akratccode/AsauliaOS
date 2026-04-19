import Link from 'next/link';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { summarizeAllocation } from '@/lib/deliverables/allocation';
import { formatDate } from '@/lib/format';

type Params = Promise<{ brandId: string }>;

export default async function AdminBrandDeliverablesPage({ params }: { params: Params }) {
  const { brandId } = await params;
  const rows = await db
    .select()
    .from(schema.deliverables)
    .where(and(eq(schema.deliverables.brandId, brandId), isNull(schema.deliverables.archivedAt)))
    .orderBy(desc(schema.deliverables.createdAt))
    .limit(200);

  const summary = summarizeAllocation(rows);

  return (
    <div className="space-y-4">
      <section
        className={`rounded-2xl border p-4 text-sm ${
          summary.flag === 'exact'
            ? 'border-asaulia-green/30 text-asaulia-green'
            : 'border-asaulia-red/30 text-asaulia-red'
        }`}
      >
        Fixed allocation: {(summary.totalBps / 100).toFixed(1)}% ·{' '}
        <span className="font-medium">{summary.flag.replace('_', ' ')}</span>. The Kanban with
        allocation tools lives in the client app — open{' '}
        <Link
          href={`/deliverables?brandId=${brandId}`}
          className="text-asaulia-blue-soft underline"
        >
          /deliverables
        </Link>{' '}
        to drag and resize.
      </section>

      <section className="border-fg-4/15 bg-bg-1 overflow-x-auto rounded-2xl border">
        <table className="w-full min-w-[640px] text-xs">
          <thead className="text-fg-3 uppercase tracking-[0.1em]">
            <tr>
              <th className="px-3 py-2 text-left">Title</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Share (bps)</th>
              <th className="px-3 py-2 text-right">Due</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="text-fg-3 px-3 py-4" colSpan={5}>
                  No deliverables yet.
                </td>
              </tr>
            ) : (
              rows.map((d) => (
                <tr key={d.id} className="border-fg-4/10 border-t">
                  <td className="text-fg-1 px-3 py-2">{d.title}</td>
                  <td className="text-fg-3 px-3 py-2 uppercase tracking-[0.1em]">{d.type}</td>
                  <td className="text-fg-2 px-3 py-2">{d.status.replace('_', ' ')}</td>
                  <td className="text-fg-2 px-3 py-2 text-right">{d.fixedShareBps}</td>
                  <td className="text-fg-3 px-3 py-2 text-right">
                    {d.dueDate ? formatDate(d.dueDate) : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
