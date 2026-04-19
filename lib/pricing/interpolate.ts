import {
  PRICING,
  PRICING_FIXED_RANGE_CENTS,
  PRICING_VARIABLE_RANGE_BPS,
} from './constants';

export function variableFromFixed(fixedCents: number): number {
  const clamped = Math.min(
    Math.max(fixedCents, PRICING.MIN_FIXED_CENTS),
    PRICING.MAX_FIXED_CENTS,
  );
  const ratio = (clamped - PRICING.MIN_FIXED_CENTS) / PRICING_FIXED_RANGE_CENTS;
  const bps = PRICING.MAX_VARIABLE_BPS - ratio * PRICING_VARIABLE_RANGE_BPS;
  return Math.round(bps);
}

export function fixedFromVariable(variableBps: number): number {
  const clamped = Math.min(
    Math.max(variableBps, PRICING.MIN_VARIABLE_BPS),
    PRICING.MAX_VARIABLE_BPS,
  );
  const ratio = (PRICING.MAX_VARIABLE_BPS - clamped) / PRICING_VARIABLE_RANGE_BPS;
  const cents = PRICING.MIN_FIXED_CENTS + ratio * PRICING_FIXED_RANGE_CENTS;
  return Math.round(cents);
}
