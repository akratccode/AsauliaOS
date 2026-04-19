import 'server-only';
import { Resend } from 'resend';
import { env } from '@/lib/env';

type EmailInput = {
  to: string;
  subject: string;
  html: string;
  from?: string;
};

let cached: Resend | null = null;

function getResend(): Resend | null {
  if (!env.RESEND_API_KEY) return null;
  cached ??= new Resend(env.RESEND_API_KEY);
  return cached;
}

export async function sendEmail({ to, subject, html, from }: EmailInput) {
  const client = getResend();
  const sender = from ?? 'Asaulia <hello@asaulia.app>';

  if (!client) {
    // In dev / test, log instead of sending so the flow still completes.
    console.warn('[email] RESEND_API_KEY not set — logging email instead of sending.');
    console.info({ to, from: sender, subject, html });
    return { id: 'noop', skipped: true as const };
  }

  const { data, error } = await client.emails.send({ from: sender, to, subject, html });
  if (error) throw new Error(`Resend send failed: ${error.message}`);
  return { id: data?.id ?? '', skipped: false as const };
}

export function invitationEmailTemplate(args: { url: string; invitedBy: string; scope: string }) {
  return {
    subject: 'You have an invitation to Asaulia',
    html: `
      <p>You were invited by <strong>${escapeHtml(args.invitedBy)}</strong> to join Asaulia as a ${escapeHtml(args.scope)}.</p>
      <p><a href="${args.url}">Accept your invitation →</a></p>
      <p style="color:#888">If you didn't expect this, you can ignore this email.</p>
    `.trim(),
  };
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return c;
    }
  });
}
