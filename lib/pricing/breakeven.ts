export function breakevenSalesCents(
  a: { fixedAmountCents: number; variablePercentBps: number },
  b: { fixedAmountCents: number; variablePercentBps: number },
): number | null {
  if (a.variablePercentBps === b.variablePercentBps) return null;
  const numerator = (b.fixedAmountCents - a.fixedAmountCents) * 10_000;
  const denominator = a.variablePercentBps - b.variablePercentBps;
  return Math.round(numerator / denominator);
}
