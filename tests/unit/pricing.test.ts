import { describe, expect, it } from 'vitest';
import {
  PRICING,
  breakevenSalesCents,
  computeSplit,
  distributeContractorPool,
  fixedFromVariable,
  PlanInputSchema,
  quote,
  sliderStopsFixedCents,
  sliderValueFromPercent,
  percentFromSliderValue,
  variableFromFixed,
  formatBps,
  formatCents,
} from '@/lib/pricing';

describe('interpolate', () => {
  it('hits anchors exactly', () => {
    expect(variableFromFixed(9_900)).toBe(2_000);
    expect(variableFromFixed(100_000)).toBe(700);
  });

  it('mid-plan example is ~1421 at $500', () => {
    expect(variableFromFixed(50_000)).toBe(1_421);
  });

  it('clamps below the minimum', () => {
    expect(variableFromFixed(0)).toBe(2_000);
  });

  it('clamps above the maximum', () => {
    expect(variableFromFixed(1_000_000)).toBe(700);
  });

  it('inverts to the anchors', () => {
    expect(fixedFromVariable(2_000)).toBe(9_900);
    expect(fixedFromVariable(700)).toBe(100_000);
  });

  it('is monotonic: higher fixed -> lower variable', () => {
    const a = variableFromFixed(20_000);
    const b = variableFromFixed(50_000);
    const c = variableFromFixed(80_000);
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(c);
  });
});

describe('validation', () => {
  it('accepts a consistent plan at the Starter anchor', () => {
    const result = PlanInputSchema.safeParse({
      fixedAmountCents: 9_900,
      variablePercentBps: 2_000,
    });
    expect(result.success).toBe(true);
  });

  it('rejects an inconsistent combo (off-curve)', () => {
    const result = PlanInputSchema.safeParse({
      fixedAmountCents: 9_900,
      variablePercentBps: 700,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a fixed amount below the minimum', () => {
    const result = PlanInputSchema.safeParse({
      fixedAmountCents: 5_000,
      variablePercentBps: 2_000,
    });
    expect(result.success).toBe(false);
  });

  it('tolerates ±1 bps rounding between fixed and variable', () => {
    const fixed = 50_000;
    const result = PlanInputSchema.safeParse({
      fixedAmountCents: fixed,
      variablePercentBps: variableFromFixed(fixed) + 1,
    });
    expect(result.success).toBe(true);
  });
});

describe('quote', () => {
  it('no sales -> only the fixed fee is owed', () => {
    expect(
      quote({ fixedAmountCents: 9_900, variablePercentBps: 2_000, attributedSalesCents: 0 }),
    ).toMatchObject({ variableAmountCents: 0, totalAmountCents: 9_900 });
  });

  it('starter at $1k in sales', () => {
    expect(
      quote({ fixedAmountCents: 9_900, variablePercentBps: 2_000, attributedSalesCents: 100_000 }),
    ).toMatchObject({ variableAmountCents: 20_000, totalAmountCents: 29_900 });
  });

  it('pro at $10k in sales', () => {
    expect(
      quote({ fixedAmountCents: 100_000, variablePercentBps: 700, attributedSalesCents: 1_000_000 }),
    ).toMatchObject({ variableAmountCents: 70_000, totalAmountCents: 170_000 });
  });
});

describe('breakeven', () => {
  it('starter vs pro breakeven is ~$6,930.77', () => {
    const starter = { fixedAmountCents: 9_900, variablePercentBps: 2_000 };
    const pro = { fixedAmountCents: 100_000, variablePercentBps: 700 };
    expect(breakevenSalesCents(starter, pro)).toBe(693_077);
  });

  it('identical variable => no breakeven', () => {
    const a = { fixedAmountCents: 9_900, variablePercentBps: 2_000 };
    const b = { fixedAmountCents: 100_000, variablePercentBps: 2_000 };
    expect(breakevenSalesCents(a, b)).toBeNull();
  });
});

describe('split', () => {
  it('starter with zero variable', () => {
    const s = computeSplit({ fixedAmountCents: 9_900, variableAmountCents: 0 });
    expect(s.contractorPoolCents).toBe(3_960);
    expect(s.asauliaCents).toBe(5_940);
    expect(s.contractorPoolCents + s.asauliaCents).toBe(9_900);
  });

  it('pro at $10k sales variable', () => {
    const s = computeSplit({ fixedAmountCents: 100_000, variableAmountCents: 70_000 });
    expect(s.contractorFixedPoolCents).toBe(40_000);
    expect(s.contractorVariablePoolCents).toBe(14_000);
    expect(s.asauliaFixedCents).toBe(60_000);
    expect(s.asauliaVariableCents).toBe(56_000);
    expect(s.contractorPoolCents + s.asauliaCents).toBe(170_000);
  });

  it('rounding residual always stays on the Asaulia side (10k random cases)', () => {
    for (let i = 0; i < 10_000; i++) {
      const fixed = Math.floor(Math.random() * 90_101) + 9_900;
      const variable = Math.floor(Math.random() * 200_000);
      const s = computeSplit({ fixedAmountCents: fixed, variableAmountCents: variable });
      expect(s.contractorPoolCents + s.asauliaCents).toBe(fixed + variable);
      expect(s.contractorFixedPoolCents).toBeLessThanOrEqual(
        Math.ceil((fixed * PRICING.CONTRACTOR_SHARE_OF_FIXED_BPS) / 10_000),
      );
    }
  });
});

describe('distribute', () => {
  it('equal deliverables split the pool evenly between two contractors', () => {
    const result = distributeContractorPool({
      contractorFixedPoolCents: 1_000,
      contractorVariablePoolCents: 0,
      deliverables: [
        { id: 'd1', assigneeUserId: 'A', fixedShareBps: 2500, status: 'done' },
        { id: 'd2', assigneeUserId: 'A', fixedShareBps: 2500, status: 'done' },
        { id: 'd3', assigneeUserId: 'B', fixedShareBps: 2500, status: 'done' },
        { id: 'd4', assigneeUserId: 'B', fixedShareBps: 2500, status: 'done' },
      ],
      contractors: [
        { userId: 'A', variableShareBps: 5000 },
        { userId: 'B', variableShareBps: 5000 },
      ],
    });
    const byUser = Object.fromEntries(result.shares.map((s) => [s.userId, s]));
    expect(byUser.A?.fixedShareCents).toBe(500);
    expect(byUser.B?.fixedShareCents).toBe(500);
    expect(result.rolloverFixedCents).toBe(0);
  });

  it('uneven share bps with a leftover cent goes to the largest remainder', () => {
    const result = distributeContractorPool({
      contractorFixedPoolCents: 1_000,
      contractorVariablePoolCents: 0,
      deliverables: [
        { id: 'd1', assigneeUserId: 'A', fixedShareBps: 3333, status: 'done' },
        { id: 'd2', assigneeUserId: 'B', fixedShareBps: 3333, status: 'done' },
        { id: 'd3', assigneeUserId: 'C', fixedShareBps: 3334, status: 'done' },
      ],
      contractors: [
        { userId: 'A', variableShareBps: 3333 },
        { userId: 'B', variableShareBps: 3333 },
        { userId: 'C', variableShareBps: 3334 },
      ],
    });
    const total = result.shares.reduce((s, r) => s + r.fixedShareCents, 0);
    expect(total).toBe(1_000);
  });

  it('rolls the fixed pool over when no deliverables are done', () => {
    const result = distributeContractorPool({
      contractorFixedPoolCents: 1_000,
      contractorVariablePoolCents: 0,
      deliverables: [
        { id: 'd1', assigneeUserId: 'A', fixedShareBps: 5000, status: 'in_progress' },
      ],
      contractors: [{ userId: 'A', variableShareBps: 10_000 }],
    });
    expect(result.shares[0]?.fixedShareCents).toBe(0);
    expect(result.rolloverFixedCents).toBe(1_000);
  });

  it('largest-remainder invariant over 100 random scenarios', () => {
    for (let i = 0; i < 100; i++) {
      const n = 2 + Math.floor(Math.random() * 5);
      const deliverables = Array.from({ length: n }, (_, k) => ({
        id: `d${k}`,
        assigneeUserId: `U${k % 3}`,
        fixedShareBps: Math.floor(Math.random() * 5000) + 1,
        status: 'done' as const,
      }));
      const contractorIds = Array.from(new Set(deliverables.map((d) => d.assigneeUserId)));
      const total = Math.floor(Math.random() * 100_000) + 1;
      const result = distributeContractorPool({
        contractorFixedPoolCents: total,
        contractorVariablePoolCents: 0,
        deliverables,
        contractors: contractorIds.map((id) => ({ userId: id, variableShareBps: 1_000 })),
      });
      const sum = result.shares.reduce((s, r) => s + r.fixedShareCents, 0);
      expect(sum).toBe(total);
    }
  });
});

describe('slider helpers', () => {
  it('produces stops spanning the full range', () => {
    const stops = sliderStopsFixedCents();
    expect(stops[0]).toBe(PRICING.MIN_FIXED_CENTS);
    expect(stops[stops.length - 1]).toBe(PRICING.MAX_FIXED_CENTS);
  });

  it('percent ↔ value is invertible', () => {
    const v = sliderValueFromPercent(0.5);
    const pct = percentFromSliderValue(v);
    expect(Math.abs(pct - 0.5)).toBeLessThan(1 / (PRICING.MAX_FIXED_CENTS - PRICING.MIN_FIXED_CENTS));
  });

  it('formatters produce human strings', () => {
    expect(formatCents(9_900)).toBe('$99.00');
    expect(formatCents(100_000)).toBe('$1,000');
    expect(formatBps(2_000)).toBe('20%');
    expect(formatBps(1_421)).toBe('14.21%');
  });
});
