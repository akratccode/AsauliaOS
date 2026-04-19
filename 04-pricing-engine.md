# Phase 04 — Pricing Engine

## Objective
Implement the single source of truth for all pricing math: interpolation between anchors, quote calculation, invoice line-item computation, payout split computation, and helpers for UI simulators. Every test for this module must pass before we touch money.

## Depends on
Phase 02 (database — to know the `plans` table shape).

## Unlocks
Phase 05 (onboarding needs the slider), Phase 11 (billing needs all the math).

---

## Core constants (create these first)

File: `lib/pricing/constants.ts`

```ts
/**
 * The pricing model is a linear interpolation between two anchor points.
 * DO NOT edit these without a business decision recorded in the PRD.
 */
export const PRICING = {
  // Fixed fee bounds (in cents).
  MIN_FIXED_CENTS: 9_900,       // $99
  MAX_FIXED_CENTS: 100_000,     // $1,000

  // Variable percentage bounds (in basis points; 10000 = 100%).
  MAX_VARIABLE_BPS: 2_000,      // 20% (paired with MIN_FIXED_CENTS)
  MIN_VARIABLE_BPS: 700,        // 7%  (paired with MAX_FIXED_CENTS)

  // Revenue split with contractors.
  CONTRACTOR_SHARE_OF_FIXED_BPS: 4_000,     // 40%
  CONTRACTOR_SHARE_OF_VARIABLE_BPS: 2_000,  // 20%

  // Policy.
  PLAN_CHANGE_COOLDOWN_DAYS: 30,
} as const;

export const PRICING_FIXED_RANGE_CENTS = PRICING.MAX_FIXED_CENTS - PRICING.MIN_FIXED_CENTS; // 90100
export const PRICING_VARIABLE_RANGE_BPS = PRICING.MAX_VARIABLE_BPS - PRICING.MIN_VARIABLE_BPS; // 1300
```

All other pricing files import from here. Never hardcode these numbers elsewhere.

---

## Tasks

### 1. `lib/pricing/interpolate.ts`

Two pure functions, perfectly mirrored:

```ts
import { PRICING, PRICING_FIXED_RANGE_CENTS, PRICING_VARIABLE_RANGE_BPS } from './constants';

/**
 * Given a fixed fee in cents, return the matching variable percentage in bps.
 * Clamps input to valid range, rounds output to nearest integer bps.
 */
export function variableFromFixed(fixedCents: number): number {
  const clamped = Math.min(Math.max(fixedCents, PRICING.MIN_FIXED_CENTS), PRICING.MAX_FIXED_CENTS);
  const ratio = (clamped - PRICING.MIN_FIXED_CENTS) / PRICING_FIXED_RANGE_CENTS;
  const bps = PRICING.MAX_VARIABLE_BPS - ratio * PRICING_VARIABLE_RANGE_BPS;
  return Math.round(bps);
}

/**
 * Inverse: given a variable bps, return the matching fixed cents.
 * Clamps and rounds.
 */
export function fixedFromVariable(variableBps: number): number {
  const clamped = Math.min(Math.max(variableBps, PRICING.MIN_VARIABLE_BPS), PRICING.MAX_VARIABLE_BPS);
  const ratio = (PRICING.MAX_VARIABLE_BPS - clamped) / PRICING_VARIABLE_RANGE_BPS;
  const cents = PRICING.MIN_FIXED_CENTS + ratio * PRICING_FIXED_RANGE_CENTS;
  return Math.round(cents);
}
```

Note: because the relationship is rounded at both ends, `variableFromFixed(fixedFromVariable(x))` may drift by 1 bps. The **fixed fee is canonical** — always store the fixed amount and derive variable from it, never the other way around.

### 2. `lib/pricing/validate.ts`

A Zod schema and a plain predicate:

```ts
import { z } from 'zod';
import { variableFromFixed } from './interpolate';
import { PRICING } from './constants';

export const PlanInputSchema = z.object({
  fixedAmountCents: z.number().int()
    .min(PRICING.MIN_FIXED_CENTS)
    .max(PRICING.MAX_FIXED_CENTS),
  variablePercentBps: z.number().int()
    .min(PRICING.MIN_VARIABLE_BPS)
    .max(PRICING.MAX_VARIABLE_BPS),
}).refine(
  (p) => Math.abs(p.variablePercentBps - variableFromFixed(p.fixedAmountCents)) <= 1,
  { message: 'variablePercentBps must match the interpolation of fixedAmountCents (±1 bps)' },
);

export type PlanInput = z.infer<typeof PlanInputSchema>;
```

This is the ONLY schema that accepts a plan input from any client. Never trust raw numbers from the UI.

### 3. `lib/pricing/quote.ts`

Calculate the invoice components given a plan and a sales total:

```ts
import { PRICING } from './constants';

export type Quote = {
  fixedAmountCents: number;
  variablePercentBps: number;
  attributedSalesCents: number;
  variableAmountCents: number;
  totalAmountCents: number;
  currency: 'USD';
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
    currency: 'USD',
  };
}
```

### 4. `lib/pricing/breakeven.ts`

Given two plans A and B, return the attributed-sales amount at which the total cost to the brand is equal.

```ts
export function breakevenSalesCents(
  a: { fixedAmountCents: number; variablePercentBps: number },
  b: { fixedAmountCents: number; variablePercentBps: number },
): number | null {
  if (a.variablePercentBps === b.variablePercentBps) return null;
  const numerator = (b.fixedAmountCents - a.fixedAmountCents) * 10_000;
  const denominator = a.variablePercentBps - b.variablePercentBps;
  return Math.round(numerator / denominator);
}
```

Note: with our anchors (Starter vs Pro), the result is ~$6,931.

### 5. `lib/pricing/split.ts`

Given an invoice, compute the contractor pool and Asaulia share:

```ts
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
  const contractorFixedPoolCents = Math.round(
    (input.fixedAmountCents * PRICING.CONTRACTOR_SHARE_OF_FIXED_BPS) / 10_000,
  );
  const contractorVariablePoolCents = Math.round(
    (input.variableAmountCents * PRICING.CONTRACTOR_SHARE_OF_VARIABLE_BPS) / 10_000,
  );
  const asauliaFixedCents = input.fixedAmountCents - contractorFixedPoolCents;
  const asauliaVariableCents = input.variableAmountCents - contractorVariablePoolCents;
  return {
    contractorPoolCents: contractorFixedPoolCents + contractorVariablePoolCents,
    asauliaCents: asauliaFixedCents + asauliaVariableCents,
    contractorFixedPoolCents,
    contractorVariablePoolCents,
    asauliaFixedCents,
    asauliaVariableCents,
  };
}
```

Rounding rule: the contractor pool is rounded down to the cent; Asaulia absorbs the rounding residual. This guarantees the split sums exactly to the total.

### 6. `lib/pricing/distribute.ts`

Distribute the contractor pool across contractors proportionally to their share of completed deliverables, weighted by `fixed_share_bps`.

Input:
```ts
type Input = {
  contractorFixedPoolCents: number;
  contractorVariablePoolCents: number;
  deliverables: Array<{
    id: string;
    assigneeUserId: string;
    fixedShareBps: number;   // this deliverable's share of the fixed pool
    status: 'done' | 'rejected' | string;
  }>;
  contractors: Array<{
    userId: string;
    variableShareBps: number; // optional per-contractor variable weight (default: equal split)
  }>;
};
```

Output: `Array<{ userId, fixedShareCents, variableShareCents, totalCents, contributingDeliverables: string[] }>`.

Rules:
- Only deliverables with status `'done'` contribute to the fixed pool.
- If no deliverables are done, the fixed pool rolls over to the next period (return with 0 distribution and a flag).
- Variable pool is distributed by `variableShareBps` among contractors (default 10000/n equally). The admin can override this weighting in later phases; the engine accepts it as input.
- Rounding: distribute with a largest-remainder method so every cent is allocated exactly, no drift.

Include a `@internal` marker comment: this function is pure; all side effects (DB writes) happen in Phase 11.

### 7. Slider helpers (for UI)

`lib/pricing/slider.ts` — pure helpers the React slider component will call:

```ts
export function sliderStopsFixedCents(stepCents = 10_000 /* $100 */): number[] {
  // returns an array of snap points from min to max.
}

export function sliderValueFromPercent(pct: number): number {
  // 0..1 → fixedCents within bounds.
}
```

Optional — if the product wants continuous slider (not snapped), you can skip stops. Default to `$100` snaps for a cleaner UX.

### 8. Export barrel

`lib/pricing/index.ts` re-exports everything public.

---

## Tests (MANDATORY — `tests/unit/pricing.test.ts`)

Cover every branch:

### Interpolation

- `variableFromFixed(9_900)` === `2_000`.
- `variableFromFixed(100_000)` === `700`.
- `variableFromFixed(50_000)` is ~`1_421` (i.e. $500 → ~14.21%). Compute: 2000 - ((50000-9900)/90100)*1300 = 2000 - 578.58 = 1421.42 → round to 1421.
- `variableFromFixed(0)` clamps to `2_000`.
- `variableFromFixed(1_000_000)` clamps to `700`.
- `fixedFromVariable(2_000)` === `9_900`.
- `fixedFromVariable(700)` === `100_000`.
- Monotonic decreasing: `variableFromFixed(a) > variableFromFixed(b)` when `a < b`.

### Validation

- `PlanInputSchema.parse({ fixedAmountCents: 9900, variablePercentBps: 2000 })` passes.
- Inconsistent combo (fixed 9900, var 700) fails with a `refine` error.
- Out-of-range values (fixed 5000) fail with a `min` error.

### Quote

- `quote({ fixed: 9_900, var: 2_000, sales: 0 })` → total `9_900`.
- `quote({ fixed: 9_900, var: 2_000, sales: 100_000 })` → variable `20_000`, total `29_900`.
- `quote({ fixed: 100_000, var: 700, sales: 1_000_000 })` → variable `70_000`, total `170_000`.

### Break-even

- Starter vs Pro breakeven === `Math.round((100000 - 9900) * 10000 / (2000 - 700))` = `Math.round(90100 * 10000 / 1300)` = `693_077` cents ≈ $6,930.77.
- Same plan on both sides returns `null`.

### Split

- `computeSplit({ fixed: 9900, variable: 0 })` → `contractorPool: 3960`, `asaulia: 5940`. Sums to 9900.
- `computeSplit({ fixed: 100000, variable: 70000 })` → `contractorPool: 40000 + 14000 = 54000`, `asaulia: 60000 + 56000 = 116000`. Sums to 170000.
- Rounding invariant: for 10,000 random inputs, `contractorPool + asaulia === fixed + variable` exactly.

### Distribution

- Given 4 deliverables with equal `fixed_share_bps = 2500`, all done, assigned to 2 contractors (A:2, B:2), fixed pool 1000: each contractor gets 500.
- Given 3 deliverables with `fixed_share_bps = [3333, 3333, 3334]`, pool 1000: distributes as 333, 333, 334 with no cent lost. Assignees can be anyone; sum must equal 1000 exactly.
- Largest-remainder property: sum of distributed === pool, for 100 random scenarios.

---

## Acceptance criteria

- All tests pass with 100% branch coverage on `lib/pricing/*`.
- `pnpm typecheck` clean.
- No hardcoded numbers anywhere else in the repo — a search for `0.07|0.2|99|1000|7%|20%` in the codebase (excluding `constants.ts` and tests) should return zero matches.

---

## Notes & gotchas

- **Never use floating-point arithmetic for money.** Stick to cents-integer everywhere. The only place floats appear is within a single local computation (the `ratio` in interpolation), immediately converted back to an integer by `Math.round`.
- **Do not implement "live repricing" on existing invoices.** If a plan changes mid-month, that only affects the next billing cycle. The current period's invoice uses the plan that was active at period start.
- **Largest-remainder rounding:** canonical algorithm. Floor each share, compute remainders, sort desc, distribute the residual cents to the top-remainder entries.
- **The admin UI must display the derived variable % as a read-only value next to the fixed slider.** Users do not enter variable % directly. Enforced in Phase 05 and Phase 08.

---

## Next phase

`05-client-onboarding.md` — onboarding flow including the pricing slider UI that uses this engine.

(Alternatively, `06-deliverables.md` can run in parallel since it only depends on Phase 03.)
