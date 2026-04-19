export type DistributeDeliverable = {
  id: string;
  assigneeUserId: string;
  fixedShareBps: number;
  status: 'done' | 'rejected' | string;
};

export type DistributeContractor = {
  userId: string;
  variableShareBps: number;
};

export type DistributeInput = {
  contractorFixedPoolCents: number;
  contractorVariablePoolCents: number;
  deliverables: DistributeDeliverable[];
  contractors: DistributeContractor[];
};

export type ContractorShare = {
  userId: string;
  fixedShareCents: number;
  variableShareCents: number;
  totalCents: number;
  contributingDeliverables: string[];
};

export type DistributeResult = {
  shares: ContractorShare[];
  rolloverFixedCents: number;
  rolloverVariableCents: number;
};

/**
 * @internal Pure computation — no DB writes. Side effects live in Phase 11.
 */
export function distributeContractorPool(input: DistributeInput): DistributeResult {
  const doneDeliverables = input.deliverables.filter((d) => d.status === 'done');
  const byContractor = new Map<string, { weight: number; ids: string[] }>();

  for (const d of doneDeliverables) {
    const entry = byContractor.get(d.assigneeUserId) ?? { weight: 0, ids: [] };
    entry.weight += d.fixedShareBps;
    entry.ids.push(d.id);
    byContractor.set(d.assigneeUserId, entry);
  }

  const fixedTotalWeight = doneDeliverables.reduce((sum, d) => sum + d.fixedShareBps, 0);
  const variableTotalWeight = input.contractors.reduce(
    (sum, c) => sum + c.variableShareBps,
    0,
  );

  const fixedAllocations =
    fixedTotalWeight > 0
      ? allocateLargestRemainder(
          input.contractors.map((c) => byContractor.get(c.userId)?.weight ?? 0),
          input.contractorFixedPoolCents,
        )
      : input.contractors.map(() => 0);

  const variableAllocations = variableTotalWeight
    ? allocateLargestRemainder(
        input.contractors.map((c) => c.variableShareBps),
        input.contractorVariablePoolCents,
      )
    : allocateEqualRemainder(
        input.contractors.length,
        input.contractorVariablePoolCents,
      );

  const shares: ContractorShare[] = input.contractors.map((c, i) => ({
    userId: c.userId,
    fixedShareCents: fixedAllocations[i] ?? 0,
    variableShareCents: variableAllocations[i] ?? 0,
    totalCents: (fixedAllocations[i] ?? 0) + (variableAllocations[i] ?? 0),
    contributingDeliverables: byContractor.get(c.userId)?.ids ?? [],
  }));

  return {
    shares,
    rolloverFixedCents:
      fixedTotalWeight > 0 ? 0 : input.contractorFixedPoolCents,
    rolloverVariableCents: input.contractors.length === 0 ? input.contractorVariablePoolCents : 0,
  };
}

function allocateLargestRemainder(weights: number[], total: number): number[] {
  const sum = weights.reduce((s, w) => s + w, 0);
  if (sum === 0 || total === 0) return weights.map(() => 0);

  const raw = weights.map((w) => (w * total) / sum);
  const floors = raw.map((v) => Math.floor(v));
  const allocated = floors.reduce((s, v) => s + v, 0);
  let remainder = total - allocated;

  const indexed = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v), weight: weights[i] ?? 0 }))
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

function allocateEqualRemainder(n: number, total: number): number[] {
  if (n === 0 || total === 0) return Array.from({ length: n }, () => 0);
  const base = Math.floor(total / n);
  const leftover = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < leftover ? 1 : 0));
}
