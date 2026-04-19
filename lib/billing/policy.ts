/**
 * Billing policy constants — the resolved PRD §6 open questions.
 *
 * Rationale for each choice lives in `docs/decisions/billing-policy.md`.
 * Change any of these only with a CHANGELOG entry + migration plan for live
 * brands. Nothing outside of `lib/billing/*` should hardcode these numbers.
 */
export const BILLING_POLICY = {
  // Proration on mid-month signup.
  // 'full_charge' — charge the full fixed fee at signup; the brand's monthly
  // cycle anchors on the signup day. No partial-month math anywhere.
  FIRST_CYCLE_MODE: 'full_charge' as const,

  // Cancellation mid-cycle. Variable is billed pro-rata on the attributed
  // sales that occurred while the plan was active.
  CANCEL_VARIABLE_MODE: 'pro_rata_active_days' as const,

  // Failed payment policy (dunning).
  GRACE_PERIOD_DAYS: 7,
  RETRY_SCHEDULE_DAYS: [1, 3, 7] as const,
  FREEZE_ON_DAY: 7,
  CANCEL_ON_DAY: 14,

  // Contractor payouts.
  MIN_PAYOUT_CENTS: 5_000, // $50 minimum; under this we carry forward.
  PAYOUT_DELAY_DAYS: 5,    // payout job runs period_end + 5 days.

  // Stripe fees. Asaulia absorbs for v1; brand invoice totals are unaffected.
  STRIPE_FEES_ABSORBED_BY: 'asaulia' as const,
} as const;

export type BillingPolicy = typeof BILLING_POLICY;
