import { CURRENCY } from './constants';

export type Quote = {
  fixedAmountCents: number;
  variablePercentBps: number;
  attributedSalesCents: number;
  variableAmountCents: number;
  totalAmountCents: number;
  currency: typeof CURRENCY;
};

export function quote(params: {
  fixedAmountCents: number;
  variablePercentBps: number;
  attributedSalesCents: number;
}): Quote {
  const variableAmountCents = Math.round(
    (params.attributedSalesCents * params.variablePercentBps) / 10_000,
  );
  return {
    ...params,
    variableAmountCents,
    totalAmountCents: params.fixedAmountCents + variableAmountCents,
    currency: CURRENCY,
  };
}
