/**
 * Normalize a list of contractor weights so they sum to exactly 10_000 bps.
 *
 * Used by the admin assignment grid: the operator can type any non-negative
 * values and we guarantee a valid distribution before persisting. Implementation
 * matches the largest-remainder approach used by `distributeContractorPool`.
 */
export function normalizeContractorWeights(weights: number[]): number[] {
  if (weights.length === 0) return [];
  const safe = weights.map((w) => (Number.isFinite(w) && w > 0 ? w : 0));
  const sum = safe.reduce((s, w) => s + w, 0);
  if (sum === 0) {
    return equalSplit(safe.length);
  }
  const raw = safe.map((w) => (w * 10_000) / sum);
  const floors = raw.map((v) => Math.floor(v));
  const allocated = floors.reduce((s, v) => s + v, 0);
  let remainder = 10_000 - allocated;
  const indexed = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v), weight: safe[i] ?? 0 }))
    .sort((a, b) => b.frac - a.frac || b.weight - a.weight);
  const result = [...floors];
  let cursor = 0;
  while (remainder > 0 && indexed.length > 0) {
    const target = indexed[cursor % indexed.length]!;
    result[target.i] = (result[target.i] ?? 0) + 1;
    remainder--;
    cursor++;
  }
  return result;
}

function equalSplit(n: number): number[] {
  const base = Math.floor(10_000 / n);
  const leftover = 10_000 - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < leftover ? 1 : 0));
}
