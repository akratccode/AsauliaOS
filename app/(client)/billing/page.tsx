import { redirect } from 'next/navigation';
import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';
import { requireAuth } from '@/lib/auth/rbac';
import { db, schema } from '@/lib/db';
import { resolveActiveBrand, requireClientBrandAccess } from '@/lib/brand/context';
import { resolveBillingWindow } from '@/lib/brand/billing-period';
import { attributedSalesForPeriod } from '@/lib/integrations/service';
import { currentAndUpcomingPlan } from '@/lib/plans/change';
import { quote } from '@/lib/pricing';
import { formatCents, formatDate } from '@/lib/format';
import { UndoCancelForm } from './undo-cancel-form';

export async function generateMetadata() {
  const t = await getTranslations('client.billing');
  return { title: t('metadata') };
}

export default async function BillingPage() {
  const actor = await requireAuth();
  const { active } = await resolveActiveBrand(actor);
  if (!active) redirect('/onboarding/brand');
  await requireClientBrandAccess(actor, active.id);

  const [brand] = await db
    .select({
      billingCycleDay: schema.brands.billingCycleDay,
      stripeCustomerId: schema.brands.stripeCustomerId,
      status: schema.brands.status,
      cancelledAt: schema.brands.cancelledAt,
      deliverablesFrozen: schema.brands.deliverablesFrozen,
      pastDueSince: schema.brands.pastDueSince,
    })
    .from(schema.brands)
    .where(eq(schema.brands.id, active.id))
    .limit(1);

  const window = resolveBillingWindow(brand?.billingCycleDay ?? null);
  const { current } = await currentAndUpcomingPlan(active.id);
  const sales = await attributedSalesForPeriod(active.id, {
    start: window.start,
    end: window.end,
  });

  const preview = current
    ? quote({
        fixedAmountCents: current.fixedAmountCents,
        variablePercentBps: current.variablePercentBps,
        attributedSalesCents: sales.totalCents,
      })
    : null;

  const invoices = await db
    .select()
    .from(schema.invoices)
    .where(eq(schema.invoices.brandId, active.id))
    .orderBy(desc(schema.invoices.periodStart))
    .limit(24);

  const lastFailedInvoice = invoices.find(
    (i) => i.status === 'failed' || i.status === 'void',
  );

  const t = await getTranslations('client.billing');

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-6">
      <header>
        <p className="text-fg-3 text-xs uppercase tracking-[0.12em]">{t('headerLabel')}</p>
        <h1 className="text-fg-1 font-serif text-3xl italic">{t('headerTitle')}</h1>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="border-fg-4/15 bg-bg-1 rounded-2xl border p-5">
          <div className="text-fg-3 text-xs uppercase tracking-[0.12em]">
            {t('nextInvoicePreview')}
          </div>
          {preview ? (
            <>
              <div className="text-fg-1 mt-1 font-serif text-3xl italic">
                {formatCents(preview.totalAmountCents)}
              </div>
              <ul className="text-fg-2 mt-3 space-y-1 text-sm">
                <li className="flex justify-between">
                  <span>{t('fixedFee')}</span>
                  <span>{formatCents(preview.fixedAmountCents)}</span>
                </li>
                <li className="flex justify-between">
                  <span>
                    {t('variable')} ({(preview.variablePercentBps / 100).toFixed(1)}%{' '}
                    { }
                    on{' '}
                    {formatCents(preview.attributedSalesCents)})
                  </span>
                  <span>{formatCents(preview.variableAmountCents)}</span>
                </li>
              </ul>
              <p className="text-fg-3 mt-3 text-xs">
                {t('closesOn')} {formatDate(window.end)}.
              </p>
            </>
          ) : (
            <p className="text-fg-3 text-sm">{t('noActivePlan')}</p>
          )}
        </div>

        <div className="border-fg-4/15 bg-bg-1 rounded-2xl border p-5">
          <div className="text-fg-3 text-xs uppercase tracking-[0.12em]">
            {t('paymentMethod')}
          </div>
          <p className="text-fg-2 mt-2 text-sm">
            {brand?.stripeCustomerId
              ? t('managedViaStripe')
              : t('paymentMethodSetDuringOnboarding')}
          </p>
          {brand?.stripeCustomerId && (
            <form action="/api/billing/portal" method="post" className="mt-4">
              <button
                type="submit"
                className="border-fg-4/20 text-fg-2 hover:text-fg-1 rounded-md border px-3 py-1.5 text-xs"
              >
                {t('openCustomerPortal')}
              </button>
            </form>
          )}
        </div>
      </section>

      {lastFailedInvoice && (
        <section className="border-asaulia-red/40 bg-asaulia-red/10 rounded-2xl border p-4 text-sm">
          <p className="text-fg-1 font-medium">{t('paymentIssue')}</p>
          <p className="text-fg-2 mt-1 text-xs">
            {t('updatePaymentMethod')}
          </p>
          {brand?.deliverablesFrozen && (
            <p className="text-fg-2 mt-2 text-xs">
              {t('deliverablesFrozen')}
            </p>
          )}
        </section>
      )}

      {brand?.cancelledAt && brand.status !== 'cancelled' && (
        <section className="border-fg-4/20 bg-bg-1 rounded-2xl border p-4 text-sm">
          <p className="text-fg-1 font-medium">{t('subscriptionSetToCancel')}</p>
          <p className="text-fg-2 mt-1 text-xs">
            {t('canReverseBefore', { date: formatDate(brand.cancelledAt) })}
          </p>
          <UndoCancelForm />
        </section>
      )}

      {!brand?.cancelledAt && brand?.status !== 'cancelled' && (
        <section className="border-fg-4/15 bg-bg-1 rounded-2xl border p-5">
          <div className="text-fg-3 text-xs uppercase tracking-[0.12em]">
            {t('cancelSubscription')}
          </div>
          <p className="text-fg-2 mt-2 text-sm">
            {t('planStaysActive')}
          </p>
          <Link
            href="/billing/cancel"
            className="border-asaulia-red/40 text-asaulia-red hover:bg-asaulia-red/5 mt-3 inline-block rounded-md border px-3 py-1.5 text-xs"
          >
            {t('cancelAtPeriodEnd')}
          </Link>
        </section>
      )}

      <section className="border-fg-4/15 bg-bg-1 rounded-2xl border p-5">
        <div className="text-fg-3 mb-3 text-xs uppercase tracking-[0.12em]">
          {t('invoiceHistory')}
        </div>
        {invoices.length === 0 ? (
          <p className="text-fg-3 text-sm">
            {t('noInvoicesYet', { date: formatDate(window.end) })}
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-fg-3 text-xs uppercase tracking-[0.12em]">
              <tr>
                <th className="py-2">{t('period')}</th>
                <th className="py-2">{t('status')}</th>
                <th className="py-2 text-right">{t('amount')}</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-fg-4/10 divide-y">
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="py-2 text-fg-2">
                    {formatDate(inv.periodStart)} – {formatDate(inv.periodEnd)}
                  </td>
                  <td className="py-2 text-fg-2 capitalize">{inv.status}</td>
                  <td className="py-2 text-right text-fg-1">
                    {formatCents(
                      (inv.fixedAmountCents ?? 0) + (inv.variableAmountCents ?? 0),
                      inv.currency,
                    )}
                  </td>
                  <td className="py-2 text-right">
                    <Link
                      href={`/billing/${inv.id}`}
                      className="text-asaulia-blue-soft text-xs hover:underline"
                    >
                      {t('view')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
