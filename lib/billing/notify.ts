import 'server-only';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { env } from '@/lib/env';
import { createNotification, sendEmailIfEnabled } from '@/lib/notifications/service';
import {
  invoicePaidTemplate,
  paymentFailedTemplate,
  payoutSentTemplate,
  payoutFailedTemplate,
} from '@/lib/notifications/templates';
import { BILLING_POLICY } from './policy';

const appUrl = () => env.NEXT_PUBLIC_APP_URL ?? 'https://asaulia.app';

async function brandOwner(brandId: string) {
  const [row] = await db
    .select({
      userId: schema.brands.ownerUserId,
      email: schema.users.email,
      name: schema.users.fullName,
    })
    .from(schema.brands)
    .innerJoin(schema.users, eq(schema.users.id, schema.brands.ownerUserId))
    .where(eq(schema.brands.id, brandId))
    .limit(1);
  return row ?? null;
}

export async function notifyInvoicePaid(params: { invoiceId: string; brandId: string }) {
  const owner = await brandOwner(params.brandId);
  if (!owner) return;

  const [invoice] = await db
    .select({
      fixedAmountCents: schema.invoices.fixedAmountCents,
      variableAmountCents: schema.invoices.variableAmountCents,
    })
    .from(schema.invoices)
    .where(eq(schema.invoices.id, params.invoiceId))
    .limit(1);
  if (!invoice) return;
  const total = invoice.fixedAmountCents + invoice.variableAmountCents;
  const url = `${appUrl()}/billing/${params.invoiceId}`;

  const tmpl = invoicePaidTemplate({ totalCents: total, url });
  await sendEmailIfEnabled({
    userId: owner.userId,
    type: 'invoice_paid',
    to: owner.email,
    subject: tmpl.subject,
    html: tmpl.html,
  });
  await createNotification({
    userId: owner.userId,
    type: 'invoice_paid',
    title: 'Payment received',
    body: `Invoice paid: $${(total / 100).toFixed(2)}`,
    linkUrl: `/billing/${params.invoiceId}`,
  });
}

export async function notifyPaymentFailed(params: {
  invoiceId: string;
  brandId: string;
  retryCount: number;
}) {
  const owner = await brandOwner(params.brandId);
  if (!owner) return;

  const [invoice] = await db
    .select({
      fixedAmountCents: schema.invoices.fixedAmountCents,
      variableAmountCents: schema.invoices.variableAmountCents,
    })
    .from(schema.invoices)
    .where(eq(schema.invoices.id, params.invoiceId))
    .limit(1);
  if (!invoice) return;
  const total = invoice.fixedAmountCents + invoice.variableAmountCents;
  const retriesLeft = Math.max(
    0,
    BILLING_POLICY.RETRY_SCHEDULE_DAYS.length - params.retryCount,
  );
  const url = `${appUrl()}/billing`;

  const tmpl = paymentFailedTemplate({ totalCents: total, url, retriesLeft });
  await sendEmailIfEnabled({
    userId: owner.userId,
    type: 'payment_failed',
    to: owner.email,
    subject: tmpl.subject,
    html: tmpl.html,
  });
  await createNotification({
    userId: owner.userId,
    type: 'payment_failed',
    title: 'Payment failed — action required',
    body: `We could not charge $${(total / 100).toFixed(2)}. ${retriesLeft} retries remaining.`,
    linkUrl: '/billing',
  });
}

export async function notifyPayoutSent(params: {
  contractorUserId: string;
  amountCents: number;
}) {
  const [user] = await db
    .select({ email: schema.users.email })
    .from(schema.users)
    .where(eq(schema.users.id, params.contractorUserId))
    .limit(1);
  if (!user) return;
  const url = `${appUrl()}/earnings`;
  const tmpl = payoutSentTemplate({ amountCents: params.amountCents, url });
  await sendEmailIfEnabled({
    userId: params.contractorUserId,
    type: 'payout_sent',
    to: user.email,
    subject: tmpl.subject,
    html: tmpl.html,
  });
  await createNotification({
    userId: params.contractorUserId,
    type: 'payout_sent',
    title: 'Payout sent',
    body: `$${(params.amountCents / 100).toFixed(2)} transferred`,
    linkUrl: '/earnings',
  });
}

export async function notifyPayoutFailed(params: {
  contractorUserId: string;
  amountCents: number;
  reason: string;
}) {
  const [user] = await db
    .select({ email: schema.users.email })
    .from(schema.users)
    .where(eq(schema.users.id, params.contractorUserId))
    .limit(1);
  if (!user) return;
  const url = `${appUrl()}/profile`;
  const tmpl = payoutFailedTemplate({
    amountCents: params.amountCents,
    reason: params.reason,
    url,
  });
  await sendEmailIfEnabled({
    userId: params.contractorUserId,
    type: 'payout_failed',
    to: user.email,
    subject: tmpl.subject,
    html: tmpl.html,
  });
  await createNotification({
    userId: params.contractorUserId,
    type: 'payout_failed',
    title: 'Payout failed',
    body: params.reason,
    linkUrl: '/profile',
  });
}
