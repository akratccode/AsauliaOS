// Period helpers.
//
// Two related concepts share this module:
//
//  1. `Period` — a `{ start, end }` pair of `YYYY-MM-DD` strings used by
//     deliverables filters and calendar-month allocation queries (Phase 06+).
//     `monthStringToPeriod` and `currentUtcPeriod` produce these.
//
//  2. `BillingCycle` — a per-brand window anchored on the brand's
//     `billing_cycle_day` (1-28). Cycles run from day N of one month through
//     the instant before day N of the next month. Returned as UTC `Date`
//     instants. Used by Phase 11 (invoice generator, payout job, dunning).

export type Period = {
  start: string; // YYYY-MM-DD (UTC)
  end: string; // YYYY-MM-DD inclusive
};

const MONTH_RE = /^(\d{4})-(\d{2})$/;

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

export function monthStringToPeriod(month: string): Period {
  const match = MONTH_RE.exec(month);
  if (!match) throw new Error(`Invalid month "${month}", expected YYYY-MM`);
  const year = Number(match[1]);
  const mon = Number(match[2]);
  if (mon < 1 || mon > 12) throw new Error(`Invalid month "${month}"`);
  const lastDay = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  return {
    start: `${year}-${pad2(mon)}-01`,
    end: `${year}-${pad2(mon)}-${pad2(lastDay)}`,
  };
}

export function currentUtcMonth(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${pad2(now.getUTCMonth() + 1)}`;
}

export function currentUtcPeriod(now: Date = new Date()): Period {
  return monthStringToPeriod(currentUtcMonth(now));
}

// ---------------------------------------------------------------------------
// Brand billing cycles (Phase 11)
// ---------------------------------------------------------------------------

export type BillingCycle = {
  start: Date; // inclusive
  end: Date; // exclusive
};

export type CycleAnchoredBrand = {
  billingCycleDay: number; // 1..28, enforced by schema
};

/**
 * Convert a UTC `Date` to `YYYY-MM-DD`.
 * This is the storage format for `invoices.period_start` / `period_end`.
 */
export function periodDateString(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/**
 * The cycle that contains `now` for a brand anchored on `billing_cycle_day`.
 * Returns UTC instants.
 *
 * Edge cases:
 * - `billing_cycle_day` is capped at 28 by schema so month-length math is safe.
 * - `now` falling exactly on the anchor at 00:00 UTC belongs to the *new* cycle.
 */
export function currentCycleFor(brand: CycleAnchoredBrand, now: Date): BillingCycle {
  const day = clampAnchorDay(brand.billingCycleDay);
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const dayOfMonth = now.getUTCDate();
  const cursor = dayOfMonth >= day
    ? new Date(Date.UTC(year, month, day, 0, 0, 0, 0))
    : new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  const end = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, day, 0, 0, 0, 0));
  return { start: cursor, end };
}

export function previousCycleFor(brand: CycleAnchoredBrand, now: Date): BillingCycle {
  const current = currentCycleFor(brand, now);
  const prevEnd = current.start;
  const day = clampAnchorDay(brand.billingCycleDay);
  const prevStart = new Date(
    Date.UTC(prevEnd.getUTCFullYear(), prevEnd.getUTCMonth() - 1, day, 0, 0, 0, 0),
  );
  return { start: prevStart, end: prevEnd };
}

export function nextCycleFor(brand: CycleAnchoredBrand, now: Date): BillingCycle {
  const current = currentCycleFor(brand, now);
  const day = clampAnchorDay(brand.billingCycleDay);
  const nextStart = current.end;
  const nextEnd = new Date(
    Date.UTC(nextStart.getUTCFullYear(), nextStart.getUTCMonth() + 1, day, 0, 0, 0, 0),
  );
  return { start: nextStart, end: nextEnd };
}

/**
 * Number of days the brand's plan was active within the given cycle.
 * Used by `pro_rata_active_days` cancellation variable computation.
 *
 * `cancelledAt === null` → full cycle length.
 * `cancelledAt < cycle.start` → 0.
 * `cancelledAt >= cycle.end` → full cycle length.
 */
export function activeDaysInCycle(
  cycle: BillingCycle,
  cancelledAt: Date | null,
): number {
  if (!cancelledAt) return fullCycleDays(cycle);
  if (cancelledAt.getTime() <= cycle.start.getTime()) return 0;
  if (cancelledAt.getTime() >= cycle.end.getTime()) return fullCycleDays(cycle);
  const ms = cancelledAt.getTime() - cycle.start.getTime();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export function fullCycleDays(cycle: BillingCycle): number {
  return Math.round((cycle.end.getTime() - cycle.start.getTime()) / 86_400_000);
}

function clampAnchorDay(day: number | null | undefined): number {
  if (!day || day < 1) return 1;
  if (day > 28) return 28;
  return day;
}
