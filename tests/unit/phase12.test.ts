import { describe, it, expect, beforeEach } from 'vitest';
import {
  rateLimit,
  RATE_LIMITS,
  _resetRateLimitsForTests,
} from '@/lib/security/rate-limit';
import {
  isTransactionalType,
  type NotificationType,
} from '@/lib/notifications/service';
import { TEMPLATES } from '@/lib/notifications/templates';

describe('rateLimit', () => {
  beforeEach(() => _resetRateLimitsForTests());

  it('allows up to the limit', () => {
    const config = { limit: 3, windowMs: 60_000 };
    for (let i = 0; i < 3; i++) {
      expect(rateLimit('alice', 'test', config).allowed).toBe(true);
    }
  });

  it('blocks once the bucket is empty', () => {
    const config = { limit: 2, windowMs: 60_000 };
    expect(rateLimit('bob', 'test', config).allowed).toBe(true);
    expect(rateLimit('bob', 'test', config).allowed).toBe(true);
    const third = rateLimit('bob', 'test', config);
    expect(third.allowed).toBe(false);
    expect(third.retryAfterMs).toBeGreaterThan(0);
  });

  it('keys are scoped — different actors have independent buckets', () => {
    const config = { limit: 1, windowMs: 60_000 };
    expect(rateLimit('carol', 'test', config).allowed).toBe(true);
    expect(rateLimit('dan', 'test', config).allowed).toBe(true);
  });

  it('scope names don\'t collide across buckets', () => {
    const config = { limit: 1, windowMs: 60_000 };
    expect(rateLimit('eve', 'scope-a', config).allowed).toBe(true);
    expect(rateLimit('eve', 'scope-b', config).allowed).toBe(true);
  });

  it('has sane defaults for every real rate-limited route', () => {
    expect(RATE_LIMITS.DELIVERABLES_POST.limit).toBeGreaterThan(0);
    expect(RATE_LIMITS.SHOPIFY_INSTALL.limit).toBeLessThan(
      RATE_LIMITS.DELIVERABLES_POST.limit,
    );
    expect(RATE_LIMITS.CHAT_POST.windowMs).toBe(60_000);
  });
});

describe('notification preferences (transactional bypass)', () => {
  const TRANSACTIONAL: NotificationType[] = [
    'invoice_issued',
    'invoice_paid',
    'payment_failed',
    'payout_sent',
    'payout_failed',
    'password_reset',
  ];
  const OPTIONAL: NotificationType[] = [
    'welcome',
    'invite',
    'deliverable_assigned',
    'deliverable_approved',
    'deliverable_rejected',
    'cycle_close_summary',
    'plan_change_confirmed',
    'chat_message',
  ];

  it('marks every payments/payouts type as transactional (unmutable)', () => {
    for (const t of TRANSACTIONAL) expect(isTransactionalType(t)).toBe(true);
  });

  it('leaves marketing/workflow types mutable', () => {
    for (const t of OPTIONAL) expect(isTransactionalType(t)).toBe(false);
  });
});

describe('email templates', () => {
  it('renders subject + html for every wired template', () => {
    const renders = [
      TEMPLATES.welcome({ name: 'Ana', appUrl: 'https://asaulia.app' }),
      TEMPLATES.invite({ invitedBy: 'Ana', scope: 'member', url: 'https://a' }),
      TEMPLATES.deliverable_assigned({ title: 'x', url: 'https://a' }),
      TEMPLATES.deliverable_approved({ title: 'x', url: 'https://a' }),
      TEMPLATES.deliverable_rejected({ title: 'x', url: 'https://a' }),
      TEMPLATES.invoice_issued({
        periodStart: '2026-04-01',
        periodEnd: '2026-04-30',
        totalCents: 30_000,
        url: 'https://a',
      }),
      TEMPLATES.invoice_paid({ totalCents: 30_000, url: 'https://a' }),
      TEMPLATES.payment_failed({ totalCents: 30_000, url: 'https://a', retriesLeft: 2 }),
      TEMPLATES.cycle_close_summary({
        periodStart: '2026-04-01',
        periodEnd: '2026-04-30',
        fixedCents: 29_900,
        variableCents: 5_000,
        salesCents: 500_00,
        url: 'https://a',
      }),
      TEMPLATES.payout_sent({ amountCents: 10_000, url: 'https://a' }),
      TEMPLATES.payout_failed({ amountCents: 10_000, reason: 'test', url: 'https://a' }),
      TEMPLATES.plan_change_confirmed({
        fixedCents: 29_900,
        variableBps: 1_420,
        effectiveFrom: '2026-05-01',
        url: 'https://a',
      }),
      TEMPLATES.chat_message({ senderName: 'Ana', excerpt: 'hi', url: 'https://a' }),
    ];
    for (const r of renders) {
      expect(r.subject.length).toBeGreaterThan(0);
      expect(r.html).toContain('<html>');
    }
  });

  it('escapes HTML-sensitive characters', () => {
    const r = TEMPLATES.invite({
      invitedBy: '<script>alert(1)</script>',
      scope: 'member',
      url: 'https://a',
    });
    expect(r.html).not.toContain('<script>alert');
    expect(r.html).toContain('&lt;script&gt;');
  });
});
