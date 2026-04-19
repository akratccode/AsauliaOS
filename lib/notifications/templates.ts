import type { NotificationType } from './service';

type TemplateFn<P> = (props: P) => { subject: string; html: string };

const shell = (bodyHtml: string) => `
<!doctype html>
<html>
  <body style="font-family: system-ui, -apple-system, sans-serif; color: #111; background: #fafaf7; padding: 24px;">
    <div style="max-width: 520px; margin: 0 auto; background: #fff; border: 1px solid #e8e6df; border-radius: 12px; padding: 24px;">
      <div style="font-family: 'Instrument Serif', Georgia, serif; font-style: italic; font-size: 24px; color: #111;">Asaulia</div>
      <div style="height: 16px;"></div>
      ${bodyHtml}
      <div style="height: 24px;"></div>
      <div style="color: #888; font-size: 12px;">Asaulia — asaulia.app</div>
    </div>
  </body>
</html>`.trim();

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return c;
    }
  });
}

function cents(v: number): string {
  return `$${(v / 100).toFixed(2)}`;
}

export const welcomeTemplate: TemplateFn<{ name?: string; appUrl: string }> = ({ name, appUrl }) => ({
  subject: 'Welcome to Asaulia',
  html: shell(`
    <h1 style="font-size: 20px; margin: 0 0 8px;">Welcome${name ? `, ${escape(name)}` : ''}</h1>
    <p style="margin: 0 0 16px; color: #444;">Your Asaulia workspace is ready. Pick your plan and connect a store to start tracking attributed sales.</p>
    <a href="${escape(appUrl)}" style="display: inline-block; background: #111; color: #fff; padding: 10px 16px; border-radius: 8px; text-decoration: none; font-size: 14px;">Open Asaulia →</a>
  `),
});

export const inviteTemplate: TemplateFn<{ invitedBy: string; scope: string; url: string }> = ({ invitedBy, scope, url }) => ({
  subject: 'You have an invitation to Asaulia',
  html: shell(`
    <h1 style="font-size: 20px; margin: 0 0 8px;">Invitation to Asaulia</h1>
    <p style="margin: 0 0 16px; color: #444;">${escape(invitedBy)} invited you to join as a ${escape(scope)}.</p>
    <a href="${escape(url)}" style="display: inline-block; background: #111; color: #fff; padding: 10px 16px; border-radius: 8px; text-decoration: none; font-size: 14px;">Accept invitation →</a>
  `),
});

export const deliverableAssignedTemplate: TemplateFn<{ title: string; url: string; dueDate?: string | null }> = ({ title, url, dueDate }) => ({
  subject: `New deliverable assigned — ${title}`,
  html: shell(`
    <h1 style="font-size: 20px; margin: 0 0 8px;">New deliverable</h1>
    <p style="margin: 0 0 8px; color: #111; font-weight: 500;">${escape(title)}</p>
    ${dueDate ? `<p style="margin: 0 0 12px; color: #666; font-size: 14px;">Due ${escape(dueDate)}</p>` : ''}
    <a href="${escape(url)}" style="display: inline-block; background: #111; color: #fff; padding: 10px 16px; border-radius: 8px; text-decoration: none; font-size: 14px;">Open deliverable →</a>
  `),
});

export const deliverableApprovedTemplate: TemplateFn<{ title: string; url: string }> = ({ title, url }) => ({
  subject: `Deliverable approved — ${title}`,
  html: shell(`
    <h1 style="font-size: 20px; margin: 0 0 8px;">Approved</h1>
    <p style="margin: 0 0 12px; color: #444;">${escape(title)} has been approved.</p>
    <a href="${escape(url)}" style="color: #111; font-size: 14px;">View deliverable →</a>
  `),
});

export const deliverableRejectedTemplate: TemplateFn<{ title: string; url: string; note?: string }> = ({ title, url, note }) => ({
  subject: `Revision requested — ${title}`,
  html: shell(`
    <h1 style="font-size: 20px; margin: 0 0 8px;">Revision requested</h1>
    <p style="margin: 0 0 8px; color: #444;">${escape(title)} needs changes.</p>
    ${note ? `<blockquote style="margin: 0 0 12px; padding: 8px 12px; border-left: 3px solid #e8e6df; color: #555; font-size: 14px;">${escape(note)}</blockquote>` : ''}
    <a href="${escape(url)}" style="color: #111; font-size: 14px;">Open deliverable →</a>
  `),
});

export const invoiceIssuedTemplate: TemplateFn<{ periodStart: string; periodEnd: string; totalCents: number; url: string }> = ({ periodStart, periodEnd, totalCents, url }) => ({
  subject: `New invoice — ${periodStart} to ${periodEnd}`,
  html: shell(`
    <h1 style="font-size: 20px; margin: 0 0 8px;">Invoice issued</h1>
    <p style="margin: 0 0 4px; color: #444;">Period: ${escape(periodStart)} to ${escape(periodEnd)}</p>
    <p style="margin: 0 0 16px; font-size: 22px; font-weight: 500;">${cents(totalCents)}</p>
    <a href="${escape(url)}" style="display: inline-block; background: #111; color: #fff; padding: 10px 16px; border-radius: 8px; text-decoration: none; font-size: 14px;">View invoice →</a>
  `),
});

export const invoicePaidTemplate: TemplateFn<{ totalCents: number; url: string }> = ({ totalCents, url }) => ({
  subject: `Payment received — ${cents(totalCents)}`,
  html: shell(`
    <h1 style="font-size: 20px; margin: 0 0 8px;">Payment received</h1>
    <p style="margin: 0 0 16px; color: #444;">${cents(totalCents)} has been received. Thank you.</p>
    <a href="${escape(url)}" style="color: #111; font-size: 14px;">View receipt →</a>
  `),
});

export const paymentFailedTemplate: TemplateFn<{ totalCents: number; url: string; retriesLeft: number }> = ({ totalCents, url, retriesLeft }) => ({
  subject: 'Payment failed — action required',
  html: shell(`
    <h1 style="font-size: 20px; margin: 0 0 8px; color: #b42318;">Payment failed</h1>
    <p style="margin: 0 0 8px; color: #444;">We could not charge ${cents(totalCents)}. Stripe will retry ${retriesLeft} more times over the next few days.</p>
    <p style="margin: 0 0 16px; color: #444;">Update your payment method to avoid service interruption.</p>
    <a href="${escape(url)}" style="display: inline-block; background: #b42318; color: #fff; padding: 10px 16px; border-radius: 8px; text-decoration: none; font-size: 14px;">Update payment method →</a>
  `),
});

export const cycleCloseSummaryTemplate: TemplateFn<{ periodStart: string; periodEnd: string; fixedCents: number; variableCents: number; salesCents: number; url: string }> = ({ periodStart, periodEnd, fixedCents, variableCents, salesCents, url }) => ({
  subject: `Cycle summary — ${periodStart} to ${periodEnd}`,
  html: shell(`
    <h1 style="font-size: 20px; margin: 0 0 8px;">Cycle summary</h1>
    <p style="margin: 0 0 12px; color: #444;">Period ${escape(periodStart)} to ${escape(periodEnd)}</p>
    <ul style="margin: 0 0 16px; padding: 0; list-style: none; color: #444; font-size: 14px;">
      <li>Attributed sales: ${cents(salesCents)}</li>
      <li>Fixed fee: ${cents(fixedCents)}</li>
      <li>Variable fee: ${cents(variableCents)}</li>
      <li style="color: #111; font-weight: 500;">Total: ${cents(fixedCents + variableCents)}</li>
    </ul>
    <a href="${escape(url)}" style="color: #111; font-size: 14px;">View full report →</a>
  `),
});

export const payoutSentTemplate: TemplateFn<{ amountCents: number; url: string }> = ({ amountCents, url }) => ({
  subject: `Payout sent — ${cents(amountCents)}`,
  html: shell(`
    <h1 style="font-size: 20px; margin: 0 0 8px;">Payout sent</h1>
    <p style="margin: 0 0 12px; color: #444;">${cents(amountCents)} is on its way to your connected bank account.</p>
    <a href="${escape(url)}" style="color: #111; font-size: 14px;">View earnings →</a>
  `),
});

export const payoutFailedTemplate: TemplateFn<{ amountCents: number; reason: string; url: string }> = ({ amountCents, reason, url }) => ({
  subject: 'Payout failed — action required',
  html: shell(`
    <h1 style="font-size: 20px; margin: 0 0 8px; color: #b42318;">Payout failed</h1>
    <p style="margin: 0 0 8px; color: #444;">${cents(amountCents)} could not be sent. Reason: ${escape(reason)}</p>
    <a href="${escape(url)}" style="display: inline-block; background: #b42318; color: #fff; padding: 10px 16px; border-radius: 8px; text-decoration: none; font-size: 14px;">Check payout settings →</a>
  `),
});

export const planChangeConfirmedTemplate: TemplateFn<{ fixedCents: number; variableBps: number; effectiveFrom: string; url: string }> = ({ fixedCents, variableBps, effectiveFrom, url }) => ({
  subject: 'Plan change confirmed',
  html: shell(`
    <h1 style="font-size: 20px; margin: 0 0 8px;">Plan updated</h1>
    <p style="margin: 0 0 4px; color: #444;">New plan: ${cents(fixedCents)} fixed + ${(variableBps / 100).toFixed(2)}% variable</p>
    <p style="margin: 0 0 16px; color: #444;">Effective from ${escape(effectiveFrom)}.</p>
    <a href="${escape(url)}" style="color: #111; font-size: 14px;">Review billing →</a>
  `),
});

export const chatMessageTemplate: TemplateFn<{ senderName: string; excerpt: string; url: string }> = ({ senderName, excerpt, url }) => ({
  subject: `New message from ${senderName}`,
  html: shell(`
    <h1 style="font-size: 20px; margin: 0 0 8px;">New message</h1>
    <p style="margin: 0 0 4px; color: #111; font-weight: 500;">${escape(senderName)}</p>
    <blockquote style="margin: 0 0 12px; padding: 8px 12px; border-left: 3px solid #e8e6df; color: #555; font-size: 14px;">${escape(excerpt)}</blockquote>
    <a href="${escape(url)}" style="color: #111; font-size: 14px;">Reply →</a>
  `),
});

export const TEMPLATES = {
  welcome: welcomeTemplate,
  invite: inviteTemplate,
  deliverable_assigned: deliverableAssignedTemplate,
  deliverable_approved: deliverableApprovedTemplate,
  deliverable_rejected: deliverableRejectedTemplate,
  invoice_issued: invoiceIssuedTemplate,
  invoice_paid: invoicePaidTemplate,
  payment_failed: paymentFailedTemplate,
  cycle_close_summary: cycleCloseSummaryTemplate,
  payout_sent: payoutSentTemplate,
  payout_failed: payoutFailedTemplate,
  plan_change_confirmed: planChangeConfirmedTemplate,
  chat_message: chatMessageTemplate,
} satisfies Partial<Record<NotificationType, TemplateFn<never>>>;
