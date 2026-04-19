import { describe, it, expect } from 'vitest';
import {
  currentCycleFor,
  previousCycleFor,
  nextCycleFor,
  activeDaysInCycle,
  fullCycleDays,
  periodDateString,
} from '@/lib/billing/period';
import { computeVariableSalesCents } from '@/lib/billing/close';
import { BILLING_POLICY } from '@/lib/billing/policy';

describe('BILLING_POLICY (PRD §6 defaults)', () => {
  it('freezes before it cancels', () => {
    expect(BILLING_POLICY.FREEZE_ON_DAY).toBeLessThan(BILLING_POLICY.CANCEL_ON_DAY);
  });
  it('has a $50 minimum payout', () => {
    expect(BILLING_POLICY.MIN_PAYOUT_CENTS).toBe(5_000);
  });
  it('retry schedule is within the grace period', () => {
    const last = BILLING_POLICY.RETRY_SCHEDULE_DAYS.at(-1)!;
    expect(last).toBeLessThanOrEqual(BILLING_POLICY.GRACE_PERIOD_DAYS);
  });
  it('absorbs Stripe fees for v1', () => {
    expect(BILLING_POLICY.STRIPE_FEES_ABSORBED_BY).toBe('asaulia');
  });
});

describe('currentCycleFor', () => {
  it('anchors on billing_cycle_day when now is after the anchor', () => {
    const now = new Date('2026-04-19T10:00:00Z');
    const c = currentCycleFor({ billingCycleDay: 5 }, now);
    expect(periodDateString(c.start)).toBe('2026-04-05');
    expect(periodDateString(c.end)).toBe('2026-05-05');
  });

  it('uses the previous month when now is before the anchor', () => {
    const now = new Date('2026-04-02T10:00:00Z');
    const c = currentCycleFor({ billingCycleDay: 15 }, now);
    expect(periodDateString(c.start)).toBe('2026-03-15');
    expect(periodDateString(c.end)).toBe('2026-04-15');
  });

  it('treats anchor-day at 00:00 UTC as start of the new cycle', () => {
    const now = new Date('2026-04-05T00:00:00Z');
    const c = currentCycleFor({ billingCycleDay: 5 }, now);
    expect(periodDateString(c.start)).toBe('2026-04-05');
  });

  it('clamps billing_cycle_day above 28 to 28', () => {
    const now = new Date('2026-02-15T12:00:00Z');
    const c = currentCycleFor({ billingCycleDay: 31 }, now);
    // 31 clamps to 28; feb 15 is before feb 28 so cycle is jan 28 → feb 28
    expect(periodDateString(c.start)).toBe('2026-01-28');
    expect(periodDateString(c.end)).toBe('2026-02-28');
  });
});

describe('previousCycleFor / nextCycleFor', () => {
  it('chains start/end boundaries', () => {
    const now = new Date('2026-04-19T00:00:00Z');
    const prev = previousCycleFor({ billingCycleDay: 5 }, now);
    const curr = currentCycleFor({ billingCycleDay: 5 }, now);
    const next = nextCycleFor({ billingCycleDay: 5 }, now);
    expect(prev.end.getTime()).toBe(curr.start.getTime());
    expect(curr.end.getTime()).toBe(next.start.getTime());
  });
});

describe('activeDaysInCycle / fullCycleDays', () => {
  it('returns the full cycle when no cancellation', () => {
    const cycle = currentCycleFor({ billingCycleDay: 1 }, new Date('2026-04-10T00:00:00Z'));
    expect(activeDaysInCycle(cycle, null)).toBe(fullCycleDays(cycle));
  });

  it('returns 0 when cancelled before the cycle started', () => {
    const cycle = currentCycleFor({ billingCycleDay: 1 }, new Date('2026-04-10T00:00:00Z'));
    expect(activeDaysInCycle(cycle, new Date('2026-02-01T00:00:00Z'))).toBe(0);
  });

  it('returns full days when cancelled after the cycle ended', () => {
    const cycle = currentCycleFor({ billingCycleDay: 1 }, new Date('2026-04-10T00:00:00Z'));
    expect(activeDaysInCycle(cycle, new Date('2026-06-01T00:00:00Z'))).toBe(
      fullCycleDays(cycle),
    );
  });

  it('counts mid-cycle cancellations with ceiling', () => {
    const cycle = currentCycleFor({ billingCycleDay: 1 }, new Date('2026-04-10T00:00:00Z'));
    // cancelled at day 15 → 15 active days
    const out = activeDaysInCycle(cycle, new Date('2026-04-15T12:00:00Z'));
    expect(out).toBeGreaterThanOrEqual(14);
    expect(out).toBeLessThanOrEqual(16);
  });
});

describe('computeVariableSalesCents (pro-rata cancel)', () => {
  const cycle = currentCycleFor({ billingCycleDay: 1 }, new Date('2026-04-10T00:00:00Z'));
  const full = fullCycleDays(cycle);

  it('returns attributed sales unchanged when active all cycle', () => {
    expect(
      computeVariableSalesCents({
        attributedSalesCents: 100_00,
        cycle,
        cancelledAt: null,
      }),
    ).toBe(100_00);
  });

  it('prorates when cancelled mid-cycle', () => {
    const mid = new Date(cycle.start.getTime() + Math.floor(full / 2) * 86_400_000);
    const out = computeVariableSalesCents({
      attributedSalesCents: 100_00,
      cycle,
      cancelledAt: mid,
    });
    // roughly half, floor-rounded
    expect(out).toBeLessThanOrEqual(50_00);
    expect(out).toBeGreaterThanOrEqual(45_00);
  });

  it('returns 0 when cancelled before cycle start', () => {
    expect(
      computeVariableSalesCents({
        attributedSalesCents: 100_00,
        cycle,
        cancelledAt: new Date('2020-01-01T00:00:00Z'),
      }),
    ).toBe(0);
  });

  it('never inflates — prorated output ≤ attributed input', () => {
    for (let i = 0; i < 30; i++) {
      const offsetDays = Math.floor(Math.random() * (full + 4)) - 2;
      const cancelledAt = new Date(cycle.start.getTime() + offsetDays * 86_400_000);
      const out = computeVariableSalesCents({
        attributedSalesCents: 1_000_00,
        cycle,
        cancelledAt,
      });
      expect(out).toBeGreaterThanOrEqual(0);
      expect(out).toBeLessThanOrEqual(1_000_00);
    }
  });
});
