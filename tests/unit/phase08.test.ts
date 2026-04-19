import { describe, it, expect } from 'vitest';
import {
  resolveBillingWindow,
  nextBillingCycleStart,
} from '@/lib/brand/billing-period';
import { salesToCsv, customerHash, type SaleRow } from '@/lib/sales/service';
import {
  PlanChangeCooldownError,
  planChangeAvailableOn,
} from '@/lib/plans/change';
import { PRICING } from '@/lib/pricing';

describe('resolveBillingWindow', () => {
  it('anchors on day 1 when no cycle day set', () => {
    const w = resolveBillingWindow(null, new Date(Date.UTC(2026, 3, 19)));
    expect(w.start.toISOString()).toBe('2026-04-01T00:00:00.000Z');
    expect(w.end.toISOString()).toBe('2026-05-01T00:00:00.000Z');
    expect(w.totalDays).toBe(30);
  });

  it('rolls back when today is before the cycle day', () => {
    // billingCycleDay=15, today=April 5 → window = Mar 15 – Apr 15
    const w = resolveBillingWindow(15, new Date(Date.UTC(2026, 3, 5)));
    expect(w.start.toISOString()).toBe('2026-03-15T00:00:00.000Z');
    expect(w.end.toISOString()).toBe('2026-04-15T00:00:00.000Z');
  });

  it('reports daysLeft clamped to the window', () => {
    const w = resolveBillingWindow(1, new Date(Date.UTC(2026, 3, 28)));
    expect(w.daysLeft).toBeGreaterThan(0);
    expect(w.daysLeft).toBeLessThanOrEqual(w.totalDays);
  });

  it('nextBillingCycleStart matches window.end', () => {
    const end = nextBillingCycleStart(15, new Date(Date.UTC(2026, 3, 5)));
    expect(end.toISOString()).toBe('2026-04-15T00:00:00.000Z');
  });
});

describe('salesToCsv', () => {
  const rows: SaleRow[] = [
    {
      id: '1',
      occurredAt: new Date('2026-04-01T12:00:00Z'),
      amountCents: 9_999,
      currency: 'USD',
      attributed: true,
      attributionReason: 'utm_source:asaulia',
      externalId: 'order_A',
      integrationId: 'i1',
      integrationName: 'Shopify — storefront',
    },
    {
      id: '2',
      occurredAt: new Date('2026-04-02T00:00:00Z'),
      amountCents: 2_500,
      currency: 'USD',
      attributed: false,
      attributionReason: null,
      externalId: 'o, with,commas',
      integrationId: 'i1',
      integrationName: 'Shopify — storefront',
    },
  ];

  it('emits a header row + one row per sale', () => {
    const csv = salesToCsv(rows);
    const lines = csv.split('\n');
    expect(lines.length).toBe(3);
    expect(lines[0]).toBe(
      'occurred_at,source,amount_cents,currency,attributed,reason,external_id',
    );
  });

  it('quotes fields containing commas', () => {
    const csv = salesToCsv(rows);
    expect(csv).toContain('"o, with,commas"');
  });

  it('emits empty reason for unattributed rows', () => {
    const csv = salesToCsv(rows);
    const line = csv.split('\n')[2] ?? '';
    expect(line).toContain(',false,,');
  });
});

describe('customerHash', () => {
  it('is deterministic and short', () => {
    const h1 = customerHash('order_1234');
    const h2 = customerHash('order_1234');
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(5);
  });
});

describe('plan cooldown math', () => {
  it('availableOn returns null when there is no prior plan', () => {
    expect(planChangeAvailableOn(null)).toBeNull();
  });

  it('availableOn = latest.createdAt + cooldown', () => {
    const base = new Date('2026-04-01T00:00:00Z');
    const available = planChangeAvailableOn(base);
    const expected = new Date(
      base.getTime() + PRICING.PLAN_CHANGE_COOLDOWN_DAYS * 86_400_000,
    );
    expect(available?.toISOString()).toBe(expected.toISOString());
  });

  it('PlanChangeCooldownError carries the available date', () => {
    const err = new PlanChangeCooldownError(new Date('2026-05-01T00:00:00Z'));
    expect(err.code).toBe('plan_change_cooldown');
    expect(err.availableOn.toISOString()).toBe('2026-05-01T00:00:00.000Z');
  });
});
