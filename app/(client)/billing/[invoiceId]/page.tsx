import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { and, eq, gte, lte } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';
import { requireAuth } from '@/lib/auth/rbac';
import { db, schema } from '@/lib/db';
import { resolveActiveBrand, requireClientBrandAccess } from '@/lib/brand/context';
import { formatCents, formatDate } from '@/lib/format';

type Params = Promise<{ invoiceId: string }>;

export async function generateMetadata() {
  const t = await getTranslations('client.billing');
  return { title: t('metadata') };
}

export default async function InvoiceDetailPage({ params }: { params: Params }) {
  const { invoiceId } = await params;
  const actor = await requireAuth();
  const { active } = await resolveActiveBrand(actor);
  if (!active) redirect('/onboarding/brand');
  await requireClientBrandAccess(actor, active.id);

  const [invoice] = await db
    .select()
    .from(schema.invoices)
    .where(
      and(eq(schema.invoices.id, invoiceId), eq(schema.invoices.brandId, active.id)),
    )
    .limit(1);
  if (!invoice) notFound();

  const attributedSales = await db
    .select({
      id: schema.salesRecords.id,
      occurredAt: schema.salesRecords.occurredAt,
      amountCents: schema.salesRecords.amountCents,
      currency: schema.salesRecords.currency,
      attributionReason: schema.salesRecords.attributionReason,
      integrationName: schema.salesIntegrations.displayName,
    })
    .from(schema.salesRecords)
    .innerJoin(
      schema.salesIntegrations,
      eq(schema.salesRecords.integrationId, schema.salesIntegrations.id),
    )
    .where(
      and(
        eq(schema.salesRecords.brandId, active.id),
        eq(schema.salesRecords.attributed, true),
        gte(schema.salesRecords.occurredAt, new Date(`${invoice.periodStart}T00:00:00Z`)),
        lte(schema.salesRecords.occurredAt, new Date(`${invoice.periodEnd}T23:59:59Z`)),
      ),
    )
    .orderBy(schema.salesRecords.occurredAt)
    .limit(500);

  const t = await getTranslations('client.billing');

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 p-6">
      <Link href="/billing" className="text-fg-3 text-xs hover:underline">
        {t('backToBilling')}
      </Link>

      <header className="flex items-end justify-between">
        <div>
          {/* eslint-disable-next-line i18next/no-literal-string -- reuses invoice-related nav label; no dedicated key */}
          <p className="text-fg-3 text-xs uppercase tracking-[0.12em]">Invoice</p>
          <h1 className="text-fg-1 font-serif text-3xl italic">
            {formatDate(invoice.periodStart)} – {formatDate(invoice.periodEnd)}
          </h1>
        </div>
        <div className="text-right text-xs capitalize text-fg-2">{invoice.status}</div>
      </header>

      <section className="border-fg-4/15 bg-bg-1 rounded-2xl border p-5">
        <ul className="divide-fg-4/10 divide-y text-sm">
          <li className="flex justify-between py-2">
            <span className="text-fg-2">{t('fixedFee')}</span>
            <span className="text-fg-1">{formatCents(invoice.fixedAmountCents ?? 0)}</span>
          </li>
          <li className="flex justify-between py-2">
            {/* eslint-disable-next-line i18next/no-literal-string -- invoice-detail label, no dedicated key */}
            <span className="text-fg-2">Variable fee</span>
            <span className="text-fg-1">{formatCents(invoice.variableAmountCents ?? 0)}</span>
          </li>
          <li className="flex justify-between py-3 text-fg-1">
            {/* eslint-disable-next-line i18next/no-literal-string -- invoice-detail label, no dedicated key */}
            <span className="font-medium">Total</span>
            <span className="font-medium">
              {formatCents(
                (invoice.fixedAmountCents ?? 0) + (invoice.variableAmountCents ?? 0),
                invoice.currency,
              )}
            </span>
          </li>
        </ul>
        {invoice.stripeInvoiceId && (
          <p className="text-fg-3 mt-3 text-xs">
            { }
            Stripe invoice: <span className="font-mono">{invoice.stripeInvoiceId}</span>
          </p>
        )}
      </section>

      <section className="border-fg-4/15 bg-bg-1 rounded-2xl border p-5">
        <div className="text-fg-3 mb-3 text-xs uppercase tracking-[0.12em]">
          { }
          Attributed sales basis
        </div>
        {attributedSales.length === 0 ? (
          /* eslint-disable-next-line i18next/no-literal-string -- invoice-detail empty state, no dedicated key */
          <p className="text-fg-3 text-sm">No attributed sales this period.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-fg-3 text-xs uppercase tracking-[0.12em]">
              <tr>
                {/* eslint-disable-next-line i18next/no-literal-string -- table header, no dedicated key */}
                <th className="py-2">Date</th>
                {/* eslint-disable-next-line i18next/no-literal-string -- table header, no dedicated key */}
                <th className="py-2">Source</th>
                {/* eslint-disable-next-line i18next/no-literal-string -- table header, no dedicated key */}
                <th className="py-2">Reason</th>
                <th className="py-2 text-right">{t('amount')}</th>
              </tr>
            </thead>
            <tbody className="divide-fg-4/10 divide-y">
              {attributedSales.map((s) => (
                <tr key={s.id}>
                  <td className="py-2 text-fg-2">{formatDate(s.occurredAt)}</td>
                  <td className="py-2 text-fg-2">{s.integrationName}</td>
                  <td className="py-2 text-fg-3 text-xs">{s.attributionReason ?? '—'}</td>
                  <td className="py-2 text-right text-fg-1">
                    {formatCents(s.amountCents, s.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <p className="text-fg-3 text-xs">
        { }
        Your subscription supports the contractors working on your brand. Individual contractor
        amounts remain private.
      </p>
    </main>
  );
}
