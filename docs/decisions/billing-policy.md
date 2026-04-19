# ADR — Billing policy for Asaulia v1

Status: Accepted — 2026-04-19
Context: Phase 11 (billing & payouts) needs concrete answers for the five open
product questions in `PRD.md §6` before any billing code ships.

The resolved values live in `lib/billing/policy.ts` as `BILLING_POLICY`.

---

## 1. First-cycle proration — `FIRST_CYCLE_MODE = 'full_charge'`

When a brand signs up mid-month, we charge the full monthly fixed fee
immediately and anchor the billing cycle on the signup day. Cycle runs from
the signup day to the same day of the following month.

Why:
- Less math, fewer edge cases. No partial-month invoice lines, no "your first
  bill is smaller because…" explanations in the UI.
- Subscription renewals land naturally on the signup-day anchor; variable
  lines land on the same invoice via `stripe.invoiceItems.create`.
- The alternative — pro-rating the first payment — requires a proration
  engine and changes the meaning of `period_start` for the first invoice.
  We refused that complexity for v1.

Trade-off:
- A brand signing up on day 28 gets their first renewal ~30 days later, not
  on the 1st of the next month. We accept this as expected behavior (billing
  cycle is personal, not calendar).

Exit criteria for revisiting: when we onboard customers who require calendar-
aligned accounting (e.g. finance departments with month-end close processes).

## 2. Cancellation variable — `CANCEL_VARIABLE_MODE = 'pro_rata_active_days'`

If a brand cancels mid-cycle, they still owe variable on attributed sales
that occurred while the plan was active. We pro-rate the variable calc to
the cancellation timestamp rather than charging for the full month.

Why:
- Variable is a commission on value delivered. Sales after cancel did not
  benefit from Asaulia's active work; we should not bill for them.
- The fixed fee is non-refundable (paid at cycle start, covers retainer-
  style availability).

Implementation:
- On `subscription.updated` with `cancel_at_period_end=true`: normal close;
  final invoice bills attributed sales through `period_end`.
- On `subscription.cancel` (immediate, admin-only): a one-off
  `invoiceItems.create` captures attributed sales through `cancel_at`.

## 3. Failed payment — 7-day grace, freeze, 14-day cancel

| Day | Action                                                              |
| --- | ------------------------------------------------------------------- |
| 0   | `invoice.payment_failed` → brand moves to `past_due`, email owner. |
| 1   | Stripe Smart Retries attempt #1.                                    |
| 3   | Smart Retries attempt #2, email owner.                              |
| 7   | Smart Retries attempt #3. Deliverables frozen. Email owner + ops.   |
| 14  | Auto-cancel subscription. Brand moves to `cancelled`.               |

Why 7/14:
- Gives legitimate card hiccups (expired, bank block, travel) enough time
  to resolve without triggering escalations.
- Aligns with Stripe's default Smart Retries window (7 days).
- Beyond 14 days the likelihood of recovery drops to <5% — continued access
  becomes bad debt, so we force the issue.

"Freeze" = set a per-brand flag that blocks finalizing deliverables
(`in_review → done` transitions). Content in progress remains editable.

## 4. Contractor payout minimum — $50 + carryover

`MIN_PAYOUT_CENTS = 5_000`. If a contractor's pool share for a period is
below $50, we do not transfer; the amount rolls into the next cycle via a
`payout_carryover_cents` column on `contractor_profiles`.

Why:
- Stripe Express transfers are free between platform and connected account,
  but the contractor's bank may charge per-deposit. A $15 payout netting
  $8 is a worse experience than a $65 payout netting $65.
- Keeps the `payouts` table meaningful — every row represents a real
  contractor-facing transaction.

Edge cases:
- Contractor ends all assignments with a nonzero carryover: we still pay
  the carryover on the next scheduled payout run (we don't zero it out).
- Carryover never earns interest and is not legally owed until paid — we
  disclose this in the contractor agreement.

## 5. Stripe fees — Asaulia absorbs

`STRIPE_FEES_ABSORBED_BY = 'asaulia'`. Card processing fees and any Connect
transfer fees reduce our margin; the brand's invoice total is the advertised
fixed + variable amount, no add-on.

Why:
- Simplicity: one quoted number, no "your bill is $1,012.34 because of card
  fees" surprises.
- Competitive positioning: v1 competitors bury fees or pass them through;
  absorbing differentiates us.
- Scale: at $299 plan floor + 2.9%+$0.30 Stripe fees ≈ $8.97 per monthly
  charge — real but manageable at our margin.

Revisit when:
- Monthly Stripe fee spend exceeds 3% of gross revenue, or
- Average plan size drops materially.

---

## Payout delay

`PAYOUT_DELAY_DAYS = 5`. We run the payout job 5 days after `period_end`
rather than immediately on `invoice.paid`. This gives us a reconciliation
buffer for:

- Late-arriving sales data that would change the variable pool.
- Disputes or partial refunds within the first few days post-payment.
- Manual attribution fixes (admin can reclassify until close + 5d).

Contractors see "Next payout: {period_end + 5d}" on their earnings page.
