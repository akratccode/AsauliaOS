import { z } from 'zod';
import { PRICING } from './constants';
import { variableFromFixed } from './interpolate';

export const PlanInputSchema = z
  .object({
    fixedAmountCents: z
      .number()
      .int()
      .min(PRICING.MIN_FIXED_CENTS)
      .max(PRICING.MAX_FIXED_CENTS),
    variablePercentBps: z
      .number()
      .int()
      .min(PRICING.MIN_VARIABLE_BPS)
      .max(PRICING.MAX_VARIABLE_BPS),
  })
  .refine(
    (p) =>
      Math.abs(p.variablePercentBps - variableFromFixed(p.fixedAmountCents)) <= 1,
    {
      message:
        'variablePercentBps must match the interpolation of fixedAmountCents (±1 bps)',
    },
  );

export type PlanInput = z.infer<typeof PlanInputSchema>;
