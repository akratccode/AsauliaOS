import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { getStripe, isStripeConfigured } from '@/lib/billing/stripe';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { writeLedger } from '@/lib/billing/ledger';
import { runPayoutsForInvoice } from '@/lib/billing/payout';
import { BILLING_POLICY } from '@/lib/billing/policy';
import type Stripe from 'stripe';

export async function POST(req: NextRequest) {
  if (!isStripeConfigured() || !env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ received: true, note: 'stripe-not-configured' });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'missing signature' }, { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'invalid signature';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  try {
    await handleEvent(event);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Still respond 200 so Stripe doesn't retry indefinitely for programmer
    // errors; the ledger + audit log capture what happened.
    return NextResponse.json({ received: true, error: msg });
  }

  return NextResponse.json({ received: true });
}

export async function GET() {
  return NextResponse.json({ ok: true });
}

async function handleEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutComplete(event);
      return;
    case 'invoice.finalized':
      await handleInvoiceFinalized(event);
      return;
    case 'invoice.paid':
      await handleInvoicePaid(event);
      return;
    case 'invoice.payment_failed':
      await handleInvoicePaymentFailed(event);
      return;
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(event);
      return;
    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(event);
      return;
    default:
      return;
  }
}

async function handleCheckoutComplete(event: Stripe.Event): Promise<void> {
  const session = event.data.object as Stripe.Checkout.Session;
  const brandId = session.metadata?.brand_id;
  const subscriptionId =
    typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
  if (!brandId || !subscriptionId) return;

  await db
    .update(schema.brands)
    .set({
      status: 'active',
      stripeSubscriptionId: subscriptionId,
      billingCycleDay: clampCycleDay(new Date().getUTCDate()),
      updatedAt: new Date(),
    })
    .where(eq(schema.brands.id, brandId));
}

async function handleInvoiceFinalized(event: Stripe.Event): Promise<void> {
  const stripeInvoice = event.data.object as Stripe.Invoice;
  const ourInvoice = await findInvoiceByStripeId(stripeInvoice);
  if (!ourInvoice) return;

  await db
    .update(schema.invoices)
    .set({
      status: 'open',
      stripeInvoiceId: stripeInvoice.id,
      issuedAt: new Date((stripeInvoice.created ?? Date.now() / 1000) * 1000),
      updatedAt: new Date(),
    })
    .where(eq(schema.invoices.id, ourInvoice.id));
}

async function handleInvoicePaid(event: Stripe.Event): Promise<void> {
  const stripeInvoice = event.data.object as Stripe.Invoice;
  const ourInvoice = await findInvoiceByStripeId(stripeInvoice);
  if (!ourInvoice) return;

  const now = new Date();
  await db
    .update(schema.invoices)
    .set({
      status: 'paid',
      paidAt: now,
      stripeInvoiceId: stripeInvoice.id,
      retryCount: 0,
      lastRetryAt: null,
      frozenAt: null,
      pastDueSince: null,
      updatedAt: now,
    })
    .where(eq(schema.invoices.id, ourInvoice.id));

  // Clear brand-level dunning state on successful payment.
  await db
    .update(schema.brands)
    .set({
      status: 'active',
      deliverablesFrozen: false,
      pastDueSince: null,
      updatedAt: now,
    })
    .where(eq(schema.brands.id, ourInvoice.brandId));

  await writeLedger({
    kind: 'invoice_paid',
    amountCents: stripeInvoice.amount_paid ?? 0,
    brandId: ourInvoice.brandId,
    invoiceId: ourInvoice.id,
    stripeEventId: event.id,
    description: `Invoice paid via Stripe (${stripeInvoice.id})`,
  });

  // Stripe processing fee — best-effort; zero if not yet available on this event.
  const stripeFeeCents = extractStripeFeeCents(stripeInvoice);
  if (stripeFeeCents > 0) {
    await writeLedger({
      kind: 'stripe_fee',
      amountCents: -stripeFeeCents,
      brandId: ourInvoice.brandId,
      invoiceId: ourInvoice.id,
      stripeEventId: `${event.id}:fee`,
      description: 'Stripe processing fee (absorbed by Asaulia)',
    });
  }

  // Schedule payout inline — cron catches up if this races, guarded by the
  // billing_jobs unique index.
  if (stripeInvoice.amount_paid && stripeInvoice.amount_paid > 0) {
    try {
      await runPayoutsForInvoice({
        invoice: {
          id: ourInvoice.id,
          brandId: ourInvoice.brandId,
          periodStart: ourInvoice.periodStart,
          periodEnd: ourInvoice.periodEnd,
          fixedAmountCents: ourInvoice.fixedAmountCents,
          variableAmountCents: ourInvoice.variableAmountCents,
        },
        now,
      });
    } catch {
      // Cron will retry.
    }
  }
}

async function handleInvoicePaymentFailed(event: Stripe.Event): Promise<void> {
  const stripeInvoice = event.data.object as Stripe.Invoice;
  const ourInvoice = await findInvoiceByStripeId(stripeInvoice);
  if (!ourInvoice) return;

  const now = new Date();
  await db
    .update(schema.invoices)
    .set({
      status: 'failed',
      retryCount: (ourInvoice.retryCount ?? 0) + 1,
      lastRetryAt: now,
      pastDueSince: ourInvoice.pastDueSince ?? now,
      updatedAt: now,
    })
    .where(eq(schema.invoices.id, ourInvoice.id));

  await db
    .update(schema.brands)
    .set({
      status: 'past_due',
      pastDueSince: now,
      updatedAt: now,
    })
    .where(eq(schema.brands.id, ourInvoice.brandId));
}

async function handleSubscriptionUpdated(event: Stripe.Event): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;
  const brand = await findBrandBySubscriptionId(subscription.id);
  if (!brand) return;

  if (subscription.cancel_at_period_end) {
    await db
      .update(schema.brands)
      .set({
        cancelledAt: subscription.cancel_at ? new Date(subscription.cancel_at * 1000) : new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.brands.id, brand.id));
  } else if (brand.cancelledAt && !subscription.cancel_at_period_end) {
    // Cancellation was reversed by the brand before the period ended.
    await db
      .update(schema.brands)
      .set({ cancelledAt: null, updatedAt: new Date() })
      .where(eq(schema.brands.id, brand.id));
  }
}

async function handleSubscriptionDeleted(event: Stripe.Event): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;
  const brand = await findBrandBySubscriptionId(subscription.id);
  if (!brand) return;

  const now = new Date();
  await db
    .update(schema.brands)
    .set({
      status: 'cancelled',
      cancelledAt: brand.cancelledAt ?? now,
      updatedAt: now,
    })
    .where(eq(schema.brands.id, brand.id));
}

async function findInvoiceByStripeId(stripeInvoice: Stripe.Invoice) {
  // Prefer the metadata brand hint set when we create invoice items.
  const brandIdHint =
    typeof stripeInvoice.metadata?.brandId === 'string' ? stripeInvoice.metadata.brandId : null;
  // Stripe's `invoice.subscription` is present at runtime on subscription-driven
  // invoices but typed only on `parent.subscription_details.subscription` in
  // newer SDKs. Read defensively across both shapes.
  const invoiceShape = stripeInvoice as unknown as {
    subscription?: string | { id: string } | null;
    parent?: { subscription_details?: { subscription?: string | { id: string } | null } | null } | null;
  };
  const rawSubscription =
    invoiceShape.subscription ?? invoiceShape.parent?.subscription_details?.subscription ?? null;
  const subscriptionId =
    typeof rawSubscription === 'string' ? rawSubscription : rawSubscription?.id ?? null;
  const customerId =
    typeof stripeInvoice.customer === 'string' ? stripeInvoice.customer : stripeInvoice.customer?.id ?? null;

  // 1. Exact match on stripe_invoice_id if already linked.
  if (stripeInvoice.id) {
    const [byStripe] = await db
      .select()
      .from(schema.invoices)
      .where(eq(schema.invoices.stripeInvoiceId, stripeInvoice.id))
      .limit(1);
    if (byStripe) return byStripe;
  }

  // 2. Otherwise resolve brand via subscription or customer, then match the
  //    most recent open/draft invoice.
  let brandId: string | null = brandIdHint;
  if (!brandId && subscriptionId) {
    const [b] = await db
      .select({ id: schema.brands.id })
      .from(schema.brands)
      .where(eq(schema.brands.stripeSubscriptionId, subscriptionId))
      .limit(1);
    if (b) brandId = b.id;
  }
  if (!brandId && customerId) {
    const [b] = await db
      .select({ id: schema.brands.id })
      .from(schema.brands)
      .where(eq(schema.brands.stripeCustomerId, customerId))
      .limit(1);
    if (b) brandId = b.id;
  }
  if (!brandId) return null;

  const [byBrand] = await db
    .select()
    .from(schema.invoices)
    .where(
      and(
        eq(schema.invoices.brandId, brandId),
        eq(schema.invoices.status, 'draft'),
      ),
    )
    .orderBy(schema.invoices.periodEnd)
    .limit(1);
  return byBrand ?? null;
}

async function findBrandBySubscriptionId(subscriptionId: string) {
  const [b] = await db
    .select()
    .from(schema.brands)
    .where(eq(schema.brands.stripeSubscriptionId, subscriptionId))
    .limit(1);
  return b ?? null;
}

function clampCycleDay(day: number): number {
  if (day < 1) return 1;
  if (day > 28) return 28;
  return day;
}

function extractStripeFeeCents(invoice: Stripe.Invoice): number {
  // Newer Stripe objects expose `total_tax_amounts` + `latest_attempt.balance_transaction`.
  // For v1 we pull the simple expansion when available and fall back to 0.
  const latest = (invoice as unknown as { charge?: { balance_transaction?: { fee?: number } } }).charge;
  return latest?.balance_transaction?.fee ?? 0;
}

// Export constant for external callers to line up with dunning policy.
export const STRIPE_WEBHOOK_POLICY = {
  FREEZE_ON_DAY: BILLING_POLICY.FREEZE_ON_DAY,
  CANCEL_ON_DAY: BILLING_POLICY.CANCEL_ON_DAY,
} as const;
