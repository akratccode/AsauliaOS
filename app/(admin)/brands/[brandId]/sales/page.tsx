import { and, desc, eq, gte } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { customerHash } from '@/lib/sales/service';
import { formatCents, formatDate } from '@/lib/format';

type Params = Promise<{ brandId: string }>;

export default async function AdminBrandSalesPage({ params }: { params: Params }) {
  const { brandId } = await params;
  const now = new Date();
  const since = new Date(now.getTime() - 90 * 86_400_000);

  const rows = await db
    .select({
      id: schema.salesRecords.id,
      occurredAt: schema.salesRecords.occurredAt,
      amountCents: schema.salesRecords.amountCents,
      currency: schema.salesRecords.currency,
      externalId: schema.salesRecords.externalId,
      attributed: schema.salesRecords.attributed,
      attributionReason: schema.salesRecords.attributionReason,
      integrationName: schema.salesIntegrations.displayName,
    })
    .from(schema.salesRecords)
    .leftJoin(
      schema.salesIntegrations,
      eq(schema.salesIntegrations.id, schema.salesRecords.integrationId),
    )
    .where(
      and(
        eq(schema.salesRecords.brandId, brandId),
        gte(schema.salesRecords.occurredAt, since),
      ),
    )
    .orderBy(desc(schema.salesRecords.occurredAt))
    .limit(200);

  return (
    <section className="border-fg-4/15 bg-bg-1 overflow-x-auto rounded-2xl border">
      <table className="w-full min-w-[720px] text-xs">
        <thead className="text-fg-3 uppercase tracking-[0.1em]">
          <tr>
            <th className="px-3 py-2 text-left">When</th>
            <th className="px-3 py-2 text-left">Integration</th>
            <th className="px-3 py-2 text-left">Customer</th>
            <th className="px-3 py-2 text-right">Amount</th>
            <th className="px-3 py-2 text-left">Attributed</th>
            <th className="px-3 py-2 text-left">Reason</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="text-fg-3 px-3 py-4" colSpan={6}>
                No sales in the last 90 days.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.id} className="border-fg-4/10 border-t">
                <td className="text-fg-3 px-3 py-2">{formatDate(r.occurredAt)}</td>
                <td className="text-fg-2 px-3 py-2">{r.integrationName ?? 'manual'}</td>
                <td className="text-fg-3 px-3 py-2 font-mono">{customerHash(r.externalId)}</td>
                <td className="text-fg-1 px-3 py-2 text-right">
                  {formatCents(r.amountCents, r.currency)}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] ${
                      r.attributed
                        ? 'bg-asaulia-green/15 text-asaulia-green'
                        : 'bg-bg-2 text-fg-3'
                    }`}
                  >
                    {r.attributed ? 'yes' : 'no'}
                  </span>
                </td>
                <td className="text-fg-3 px-3 py-2">{r.attributionReason ?? '—'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}
