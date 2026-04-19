// Period helpers. Fully implemented in Phase 11 (billing & payouts).
// This stub provides shape-compatible helpers used by Phase 06 deliverables
// filters and allocation queries.

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
