import { describe, it, expect } from 'vitest';
import { quote, computeSplit, distributeContractorPool, PRICING } from '@/lib/pricing';
import type { DistributeDeliverable } from '@/lib/pricing/distribute';

// Mirrors the computation inside `projectEarningsForPeriod` so we can verify
// the end-to-end math without hitting the DB.
function projectForContractor(params: {
  userId: string;
  planFixedCents: number;
  planVariableBps: number;
  attributedSalesCents: number;
  deliverables: DistributeDeliverable[];
  contractorIds: string[];
}) {
  const q = quote({
    fixedAmountCents: params.planFixedCents,
    variablePercentBps: params.planVariableBps,
    attributedSalesCents: params.attributedSalesCents,
  });
  const split = computeSplit({
    fixedAmountCents: q.fixedAmountCents,
    variableAmountCents: q.variableAmountCents,
  });
  const dist = distributeContractorPool({
    contractorFixedPoolCents: split.contractorFixedPoolCents,
    contractorVariablePoolCents: split.contractorVariablePoolCents,
    deliverables: params.deliverables,
    contractors: params.contractorIds.map((userId) => ({ userId, variableShareBps: 0 })),
  });
  return { split, dist, mine: dist.shares.find((s) => s.userId === params.userId)! };
}

describe('projectEarningsForPeriod math', () => {
  it('$299 plan · 14.2% · $5,000 sales · 5 of 10 deliverables done by me', () => {
    // 10 deliverables: 5 mine (all done), 5 someone else's (all done) — equal 1000-bps each.
    const deliverables: DistributeDeliverable[] = [
      ...Array.from({ length: 5 }, (_, i) => ({
        id: `mine-${i}`,
        assigneeUserId: 'me',
        fixedShareBps: 1_000,
        status: 'done' as const,
      })),
      ...Array.from({ length: 5 }, (_, i) => ({
        id: `theirs-${i}`,
        assigneeUserId: 'other',
        fixedShareBps: 1_000,
        status: 'done' as const,
      })),
    ];

    const result = projectForContractor({
      userId: 'me',
      planFixedCents: 29_900, // $299
      planVariableBps: 1_420, // 14.2%
      attributedSalesCents: 500_000, // $5,000
      deliverables,
      contractorIds: ['me', 'other'],
    });

    // Sanity on intermediate pools:
    //   variable = 5000 * 14.2% = $710 → 71000 cents
    //   contractor fixed pool = 29900 * 40% = 11960
    //   contractor variable pool = 71000 * 20% = 14200
    expect(result.split.contractorFixedPoolCents).toBe(11_960);
    expect(result.split.contractorVariablePoolCents).toBe(14_200);

    // Equal weight (5000 vs 5000 bps) → exact half each for fixed.
    expect(result.mine.fixedShareCents).toBe(5_980);
    // Equal split among 2 contractors for variable pool.
    expect(result.mine.variableShareCents).toBe(7_100);
    expect(result.mine.totalCents).toBe(5_980 + 7_100);
  });

  it('rolls over fixed pool when no deliverables are done', () => {
    const deliverables: DistributeDeliverable[] = [
      { id: 'a', assigneeUserId: 'me', fixedShareBps: 5_000, status: 'in_progress' },
      { id: 'b', assigneeUserId: 'other', fixedShareBps: 5_000, status: 'in_review' },
    ];
    const result = projectForContractor({
      userId: 'me',
      planFixedCents: 29_900,
      planVariableBps: 1_420,
      attributedSalesCents: 0,
      deliverables,
      contractorIds: ['me', 'other'],
    });
    expect(result.mine.fixedShareCents).toBe(0);
    expect(result.dist.rolloverFixedCents).toBe(11_960);
  });

  it('pays all to solo contractor when they did every done deliverable', () => {
    const deliverables: DistributeDeliverable[] = [
      { id: 'a', assigneeUserId: 'me', fixedShareBps: 5_000, status: 'done' },
      { id: 'b', assigneeUserId: 'me', fixedShareBps: 5_000, status: 'done' },
    ];
    const result = projectForContractor({
      userId: 'me',
      planFixedCents: 29_900,
      planVariableBps: 1_420,
      attributedSalesCents: 500_000,
      deliverables,
      contractorIds: ['me'],
    });
    expect(result.mine.fixedShareCents).toBe(11_960);
    expect(result.mine.variableShareCents).toBe(14_200);
  });
});

describe('pricing constants are the single source of truth', () => {
  it('contractor share is 40% of fixed, 20% of variable', () => {
    expect(PRICING.CONTRACTOR_SHARE_OF_FIXED_BPS).toBe(4_000);
    expect(PRICING.CONTRACTOR_SHARE_OF_VARIABLE_BPS).toBe(2_000);
  });
});
