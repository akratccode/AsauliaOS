import { PRICING } from './constants';

export type SplitBreakdown = {
  contractorPoolCents: number;
  asauliaCents: number;
  contractorFixedPoolCents: number;
  contractorVariablePoolCents: number;
  asauliaFixedCents: number;
  asauliaVariableCents: number;
};

export function computeSplit(input: {
  fixedAmountCents: number;
  variableAmountCents: number;
}): SplitBreakdown {
  const contractorFixedPoolCents = Math.floor(
    (input.fixedAmountCents * PRICING.CONTRACTOR_SHARE_OF_FIXED_BPS) / 10_000,
  );
  const contractorVariablePoolCents = Math.floor(
    (input.variableAmountCents * PRICING.CONTRACTOR_SHARE_OF_VARIABLE_BPS) / 10_000,
  );
  const asauliaFixedCents = input.fixedAmountCents - contractorFixedPoolCents;
  const asauliaVariableCents =
    input.variableAmountCents - contractorVariablePoolCents;
  return {
    contractorPoolCents: contractorFixedPoolCents + contractorVariablePoolCents,
    asauliaCents: asauliaFixedCents + asauliaVariableCents,
    contractorFixedPoolCents,
    contractorVariablePoolCents,
    asauliaFixedCents,
    asauliaVariableCents,
  };
}
