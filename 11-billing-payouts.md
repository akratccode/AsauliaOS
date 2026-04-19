# Phase 11 — Billing & Payouts

## Objective
Automate the monthly billing cycle: close the period, compute the variable fee from attributed sales, generate the invoice in Stripe, charge the card, compute the contractor distribution, and pay out via Stripe Connect. Handle failed payments, cancellations, and proration. Resolve the open product questions from `PRD.md §6`.

## Depends on
Phase 04 (pricing engine), Phase 07 (integrations). In practice also Phases 05, 06, 09, 10 for the surrounding UX.

## Unlocks
Phase 12 (launch polish).

---

## Resolve open product questions first

Before writing code, make the following product decisions explicit and codify them in `lib/billing/policy.ts`:

```ts
export const BILLING_POLICY = {
  // Proration on mid-month signup
  FIRST_CYCLE_MODE: 'full_charge' as const, // charge full fixed; cycle starts signup day
  // (alternative: 'prorated' — not implemented in v1)

  // Cancellation variable
  CANCEL_VARIABLE_MODE: 'pro_rata_active_days' as const,

  // Failed payment
  GRACE_PERIOD_DAYS: 7,
  RETRY_SCHEDULE_DAYS: [1, 3, 7], // retry 1, 3, 7 days after initial failure
  FREEZE_ON_DAY: 7,               // deliverables frozen
  CANCEL_ON_DAY: 14,               // auto-cancel

  // Contractor payouts
  MIN_PAYOUT_CENTS: 5_000, // $50
  PAYOUT_DELAY_DAYS: 5,     // payout runs 5 days after cycle close (reconciliation buffer)

  // Who absorbs Stripe fees
  STRIPE_FEES_ABSORBED_BY: 'asaulia' as const, // brand's invoice total is unchanged
} as const;
```

Record the rationale for each choice in `docs/decisions/billing-policy.md` (ADR-style).

---

## Billing cycle model

Each brand has a `billing_cycle_day` (1–28) set at first payment. A cycle starts at 00:00 in the brand's timezone on that day and ends immediately before the same day next month.

Functions in `lib/billing/period.ts`:

```ts
currentPeriodFor(brand: Brand, now: Date): { start: Date; end: Date };
previousPeriodFor(brand: Brand, now: Date): { start: Date; end: Date };
nextPeriodFor(brand: Brand, now: Date): { start: Date; end: Date };
```

All return UTC instants. Handle the edge case of billing_cycle_day = 29/30/31 in short months — we cap at 28 in our schema to avoid this entirely.

---

## Tasks

### 1. Cycle close job

`app/api/cron/close-cycles/route.ts` — runs hourly, processes brands whose current period ended within the last hour.

Pseudocode:

```ts
export async function POST(req: Request) {
  requireCronSecret(req);
  const brands = await findBrandsWithPeriodEndInLastHour();
  for (const brand of brands) {
    await processCycleClose(brand);
  }
  return ok();
}
```

`processCycleClose(brand)` in `lib/billing/close.ts`:

1. Compute the just-ended period `{ start, end }`.
2. Load the plan that was active at `start` (not the current plan, which may have changed).
3. Aggregate attributed sales for the period (via `attributedSalesForPeriod` from Phase 07).
4. Compute `variableAmountCents = round(sales * variable_bps / 10000)`.
5. Create `invoices` row in status `draft` with `fixed_amount_cents`, `variable_amount_cents`, `plan_snapshot`, `attributed_sales_cents`.
6. Create or ensure the Stripe subscription is set up so that the next invoice will include an extra `invoiceItem` for the variable:
   - Fetch the upcoming invoice from Stripe.
   - `stripe.invoiceItems.create({ customer, amount: variable_amount_cents, currency: 'usd', description: 'Variable fee — ...period description...', subscription })` so it attaches to the upcoming subscription invoice, NOT a standalone invoice.
   - Now the subscription's next invoice will include: the fixed component (via subscription item) + the variable line item.
7. Mark our `invoices.status = 'open'` and save `stripe_invoice_id` once Stripe finalizes it (webhook will).
8. Schedule payout job for the same period (see §3).

Idempotency: use a lock per `(brand_id, period_start)` — a unique insert into a `billing_jobs` table before processing. If a row exists with `status != 'failed'`, skip.

### 2. Stripe webhook handler

`app/api/webhooks/stripe/route.ts` — already stubbed in Phase 05, fully implement now.

Events to handle:
- `customer.subscription.created` — link to brand (should already be linked from checkout).
- `invoice.finalized` — update our `invoices.stripe_invoice_id`, `issued_at`, status → `open`.
- `invoice.paid` — mark `status = 'paid'`, `paid_at`. Trigger payout logic (or wait for the delay job).
- `invoice.payment_failed` — mark `status = 'failed'`, start dunning (see §5).
- `invoice.payment_action_required` — email the customer.
- `customer.subscription.deleted` — mark brand `cancelled`.
- `customer.subscription.updated` — if `cancel_at_period_end = true`, we know cancellation is coming; flag it.

Every event is verified via `stripe.webhooks.constructEvent(body, signature, secret)`. Raw body required — use `req.text()` in a route handler with `export const config = { api: { bodyParser: false } }` equivalent (App Router: just use `req.text()`; don't pre-parse JSON).

Always respond `200` quickly; enqueue heavier work into a background job (for v1, inline processing is fine since events are low volume).

### 3. Payout job

`app/api/cron/run-payouts/route.ts` — runs daily at 09:00 UTC.

Finds `invoices` with `status = 'paid'`, `period_end < now - BILLING_POLICY.PAYOUT_DELAY_DAYS`, and no matching `payouts` row yet.

For each such invoice:

1. Compute the split via `computeSplit()` from Phase 04.
2. Load deliverables for the period. Filter by status `'done'`.
3. Load assigned contractors and their weight overrides (from `brand_contractor_weights` in Phase 10) for the period.
4. Run `distribute()` from Phase 04 to produce per-contractor amounts.
5. For each contractor:
   - Fetch their `contractor_profiles.stripe_connect_account_id`.
   - If missing or not active, mark that line as `pending_setup` — carry over to next period.
   - Else, `stripe.transfers.create({ amount, currency: 'usd', destination: stripe_connect_account_id, description: 'Asaulia payout — ...', metadata: { period_start, period_end, brand_ids } })`.
   - Insert/update `payouts` row: one row per contractor per period, breakdown JSON holds per-brand detail.
6. If total owed < `MIN_PAYOUT_CENTS` for a contractor, defer. Carry forward: store in `payout_carryover` column on `contractor_profiles`, add to next cycle.

Payout status lifecycle: `pending → processing → paid | failed`. Stripe transfer response sets `status = 'paid'` immediately for Express accounts with `payouts_enabled`.

### 4. Proration on signup

First cycle = `signup_day → signup_day + 1 month`, charged in full. This keeps math simple.

If we decide to allow prorated first cycles later, the math is: `fixed_amount_cents * days_remaining / days_in_month`. Don't implement in v1.

### 5. Failed payments (dunning)

State machine:

```
invoice.payment_failed → brand.status = 'past_due'
  Day 1:  retry (Stripe smart retries enabled)
  Day 3:  retry, email owner
  Day 7:  retry, email owner + operator, FREEZE deliverables (block status transitions to done)
  Day 14: cancel subscription, mark brand 'cancelled'
```

Implementation:
- Track retry state on `invoices` (`retry_count`, `last_retry_at`, `frozen_at`).
- Use Stripe's built-in smart retries (Subscription Settings → Recovery), which handles the retry schedule cleanly.
- On our side, a daily job `app/api/cron/dunning/route.ts` checks for past-due invoices and applies the freeze/cancel transitions.
- "Freeze" = set a flag on brand (`deliverables_frozen = true`). In Phase 06's status-change service, check this flag and block transitions that finalize work (`in_review → done`) with a clear error.

### 6. Cancellation handling

Client requests cancellation via `/billing` settings (Phase 08).

Two modes:
- **At period end (recommended default):** `stripe.subscriptions.update(id, { cancel_at_period_end: true })`. Brand remains active until period end, then moves to `cancelled`. Variable bills normally at close. Final invoice paid; no refunds.
- **Immediate:** `stripe.subscriptions.cancel(id)`. Compute pro-rata variable on attributed sales between period start and cancel date; create an off-cycle invoice item for that amount. Refund the unused portion of the fixed fee pro-rata (`stripe.creditNotes.create({ invoice, amount })`).

v1 supports "At period end" only. Immediate cancel is admin-only via the console.

### 7. Receipts & PDFs

Stripe auto-generates a hosted PDF per invoice (`hosted_invoice_url`, `invoice_pdf`).

In `invoices` detail page (Phase 08), the "Download" button links to `invoice.invoice_pdf` after we save it from the `invoice.finalized` webhook.

For contractor payouts, Stripe Connect Express auto-generates a similar report accessible in their Express dashboard. We do NOT need to generate custom PDFs in v1.

### 8. Ledger / accounting

To reconcile at year-end, record a ledger entry for every money movement:

Table `ledger_entries`:
- `id`, `occurred_at`, `kind` enum: `'invoice_issued' | 'invoice_paid' | 'payout_sent' | 'refund' | 'stripe_fee' | 'adjustment'`
- `amount_cents` (signed)
- `currency`
- `brand_id` (nullable), `contractor_user_id` (nullable), `invoice_id` (nullable), `payout_id` (nullable)
- `description`
- `stripe_event_id` (nullable) — idempotency hook

Write to this ledger from:
- Invoice issuance (negative receivable, positive on paid).
- Payouts (negative from our balance, positive to contractor).
- Stripe fees (deduct from Asaulia's margin; pulled from Stripe balance transactions nightly).

Expose via `finances/page.tsx` (Phase 10).

### 9. Edge cases checklist

- [x] Brand on day N where N > 28: mitigated by capping `billing_cycle_day` at 28 in the schema (Phase 02) and re-clamped in `clampAnchorDay` (Phase 11).
- [x] Timezone DST: cycle boundaries are UTC instants (we don't store brand-local offsets); DST never shifts a cycle. Documented in `lib/billing/period.ts`.
- [x] Integration goes offline mid-period: variable is computed only on the sales we have; backfill enters the next period (we never rewrite closed invoices — guarded by the `invoices_brand_period_unique` index).
- [x] Attribution rules changed mid-period: Phase 07's `attributedSalesForPeriod` reads the current rules; closed invoices carry `attributed_sales_cents` and `plan_snapshot` so the closed total is locked.
- [x] Manual sale added after cycle close: falls into the NEXT period via the billing-jobs idempotency lock; admin warned via the `sales` page breakdown.
- [x] Contractor Stripe Connect account deactivated right before payout: `settleContractorShare` emits `pending_setup`, preserves the carryover on `contractor_profiles.payout_carryover_cents`, and inserts a failed payout row for the admin queue.

---

## Acceptance criteria

- A cycle close job run against a test brand with $0 sales produces an invoice with only the fixed amount.
- A cycle close job run against a brand with $5,000 attributed sales on a $299 + 14.2% plan produces variable = 5000 * 1420 / 10000 = $710, total = $1,009.
- `invoice.paid` webhook correctly triggers a `payouts` row for each active contractor on that brand, and their Stripe Connect balance increments in test mode.
- A failed payment triggers Stripe's retry cycle and freezes deliverables on day 7.
- Idempotent: re-running cycle close for the same period does not create duplicate invoices or double-charge. Verified by running the job twice and asserting single row insert.
- Ledger entries balance: sum of kind=`invoice_paid` − kind=`payout_sent` − kind=`stripe_fee` = Asaulia retained margin, verifiable by a reconciliation query.

---

## Tests

Unit (`tests/unit/billing.test.ts`):
- `closeCycle` for a fixture brand produces expected invoice numbers (deterministic).
- `distribute` integration: given fixture deliverables + attributed sales, payouts for 3 contractors sum exactly to the contractor pool.
- Dunning state machine transitions correctly given synthetic clock.

Integration (`tests/integration/billing.e2e.ts`):
- Use the Stripe CLI fixtures to replay a paid invoice webhook; verify our DB state.
- Replay a `payment_failed` webhook; verify brand goes past_due.

Reconciliation:
- A nightly check (script in `scripts/reconcile.ts`) runs against the ledger and errors out if sums don't balance. Add to CI optional job.

---

## Notes & gotchas

- **Stripe API version:** pin to a specific version (e.g. `2024-06-20`) in the Stripe client constructor. Never auto-upgrade — breaking changes have bitten us.
- **Webhook replay:** Stripe retries up to 3 days. Guarantee idempotency via `stripe_event_id` uniqueness in `ledger_entries` and `invoices`.
- **Transfers vs payouts:** Stripe Connect has both concepts. In Express, we create `transfers` (money moves from platform to connected account); Stripe then automatically does `payouts` from the connected account to their bank. We only care about the `transfer` step.
- **Taxes:** out of scope for v1. Brand is responsible for their own sales tax. Asaulia is responsible for its own business taxes.
- **Currency:** USD only. Table schemas allow multi-currency but code paths assume USD everywhere in v1. Enforce with a `z.literal('USD')` at API boundaries.
- **Clock-skew:** server clocks drift; use `now = new Date()` at the top of the job and pass `now` to all helpers. Don't call `new Date()` inside a loop and compare.
- **"Paid" timing:** `invoice.paid` on subscription invoices fires after the charge succeeds. Fixed + variable are on the SAME invoice, so the webhook fires once per cycle close. Payout logic keys off that.

---

## Next phase

`12-polish-launch.md` — email, notifications, chat, final UX polish, launch readiness.
