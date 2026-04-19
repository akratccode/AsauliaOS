import { desc, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { formatCents, formatDate } from '@/lib/format';

type Params = Promise<{ brandId: string }>;

export default async function AdminBrandInvoicesPage({ params }: { params: Params }) {
  const { brandId } = await params;
  const rows = await db
    .select()
    .from(schema.invoices)
    .where(eq(schema.invoices.brandId, brandId))
    .orderBy(desc(schema.invoices.periodStart));

  return (
    <div className="space-y-4">
      <section className="border-fg-4/15 bg-bg-1 overflow-x-auto rounded-2xl border">
        <table className="w-full min-w-[720px] text-xs">
          <thead className="text-fg-3 uppercase tracking-[0.1em]">
            <tr>
              <th className="px-3 py-2 text-left">Period</th>
              <th className="px-3 py-2 text-right">Fixed</th>
              <th className="px-3 py-2 text-right">Variable</th>
              <th className="px-3 py-2 text-right">Total</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Issued</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="text-fg-3 px-3 py-4" colSpan={6}>
                  No invoices yet — generated automatically at cycle close (Phase 11).
                </td>
              </tr>
            ) : (
              rows.map((i) => (
                <tr key={i.id} className="border-fg-4/10 border-t">
                  <td className="text-fg-2 px-3 py-2">
                    {formatDate(i.periodStart)} – {formatDate(i.periodEnd)}
                  </td>
                  <td className="text-fg-1 px-3 py-2 text-right">
                    {formatCents(i.fixedAmountCents, i.currency)}
                  </td>
                  <td className="text-fg-1 px-3 py-2 text-right">
                    {formatCents(i.variableAmountCents, i.currency)}
                  </td>
                  <td className="text-fg-1 px-3 py-2 text-right font-medium">
                    {formatCents((i.totalAmountCents ?? 0), i.currency)}
                  </td>
                  <td className="px-3 py-2">
                    <span className="bg-bg-2 text-fg-2 rounded-full px-2 py-0.5 text-[11px]">
                      {i.status}
                    </span>
                  </td>
                  <td className="text-fg-3 px-3 py-2">
                    {i.issuedAt ? formatDate(i.issuedAt) : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
      <p className="text-fg-3 text-xs">
        Manual generation + void-and-reissue controls land with Phase 11. Admin schema support is
        ready.
      </p>
    </div>
  );
}
