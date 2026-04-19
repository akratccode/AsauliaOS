import { and, eq, isNull } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import type { AllocationFlag } from './types';

export const MAX_SINGLE_SHARE_BPS = 5_000;
export const TOTAL_ALLOCATION_BPS = 10_000;

export type AllocationSummary = {
  totalBps: number;
  flag: AllocationFlag;
  itemCount: number;
};

type DeliverableRow = Pick<
  typeof schema.deliverables.$inferSelect,
  'id' | 'fixedShareBps' | 'archivedAt'
>;

export function summarizeAllocation(
  rows: ReadonlyArray<Pick<DeliverableRow, 'fixedShareBps' | 'archivedAt'>>,
): AllocationSummary {
  const active = rows.filter((r) => r.archivedAt === null);
  const totalBps = active.reduce((sum, r) => sum + r.fixedShareBps, 0);
  let flag: AllocationFlag = 'exact';
  if (totalBps < TOTAL_ALLOCATION_BPS) flag = 'under_allocated';
  else if (totalBps > TOTAL_ALLOCATION_BPS) flag = 'over_allocated';
  return { totalBps, flag, itemCount: active.length };
}

export function validateSingleShareBps(shareBps: number): void {
  if (shareBps < 0 || shareBps > MAX_SINGLE_SHARE_BPS) {
    throw new Error(
      `fixed_share_bps must be between 0 and ${MAX_SINGLE_SHARE_BPS}, got ${shareBps}`,
    );
  }
}

export async function validateAllocation(
  brandId: string,
  period: { start: string; end: string },
): Promise<AllocationSummary> {
  const rows = await db
    .select({
      fixedShareBps: schema.deliverables.fixedShareBps,
      archivedAt: schema.deliverables.archivedAt,
    })
    .from(schema.deliverables)
    .where(
      and(
        eq(schema.deliverables.brandId, brandId),
        eq(schema.deliverables.periodStart, period.start),
        eq(schema.deliverables.periodEnd, period.end),
        isNull(schema.deliverables.archivedAt),
      ),
    );
  return summarizeAllocation(rows);
}
