# Phase 05 — Client Onboarding

## Objective
A multi-step onboarding flow that takes a brand-new client from signup to first paid subscription, including brand setup, plan selection on a slider, and Stripe payment method capture. Creates the first `plans` row, first `brands` row, and first `invoice` (fixed component only, since there are no sales yet).

## Depends on
Phase 03 (auth), Phase 04 (pricing engine).

## Unlocks
Phase 08 (client dashboard).

---

## Flow overview

```
Signup ─▶ /onboarding/brand ─▶ /onboarding/plan ─▶ /onboarding/payment ─▶ /dashboard
           (name, logo,         (slider, quote       (Stripe Elements,      (empty state,
            website, tz)         projection)          first invoice)         next-phase CTAs)
```

State is persisted on each step so users can drop out and resume. Use a simple cookie + DB-backed approach (a pending `brands` row with `status = 'trial'` until payment succeeds).

---

## Tasks

### 1. Route group

- [ ] `app/(onboarding)/layout.tsx` — shared header with progress indicator (3 steps).
- [ ] `app/(onboarding)/brand/page.tsx`
- [ ] `app/(onboarding)/plan/page.tsx`
- [ ] `app/(onboarding)/payment/page.tsx`
- [ ] `app/(onboarding)/complete/page.tsx` — landing after success; redirects to `/dashboard` after a moment.

Middleware: authenticated users with no `brand_members` row or whose brand has `status = 'trial'` are routed through onboarding. Users with `status = 'active'` go to `/dashboard`.

### 2. Step 1 — Brand setup

Fields:
- Brand name (required, 2–60 chars).
- Slug (auto-generated from name, editable, uniqueness-checked).
- Logo (optional, uploaded to Supabase Storage `brand-logos` bucket).
- Website URL (optional).
- Timezone (select, default from browser).
- Primary contact email (pre-filled from user).

Server action `createBrand`:
- Validates with Zod.
- Inserts a `brands` row with `status = 'trial'` and `owner_user_id = currentUser.id`.
- Inserts a `brand_members` row (`role = 'owner'`).
- Sets a cookie `onboarding_brand_id` for the next steps.

Auditing: log the creation.

### 3. Step 2 — Plan selection (the headline UI)

This is the differentiating UX of the whole product. Spend design care here.

Components:
- `components/pricing-slider/PricingSlider.tsx` — a slider from $99 to $1,000 in $100 steps (configurable; use `sliderStopsFixedCents` from Phase 04).
- As the user drags, the following update live:
  - Large number: the fixed monthly amount (e.g. "$299/month").
  - Derived variable %: read-only, computed via `variableFromFixed()` (e.g. "+ 14.2% of attributed sales").
  - Slider track color: a gradient cue from "more variable" to "more fixed".
- Below the slider:
  - A projection widget. User enters expected monthly attributed sales (defaults to $3,000). Show:
    - Monthly total at the selected point.
    - Monthly total at the two anchors (Starter / Pro) for comparison.
    - Highlight the cheapest for them given the projection.
- A line-chart preview (reuse the concept from the visualization we already shared) plotting total cost vs sales for (a) their chosen point, (b) Starter, (c) Pro.

Accessibility: slider is keyboard-operable with left/right arrow keys stepping by $100, page up/down by $500.

All values typed as `number` (cents) in state; render uses `Intl.NumberFormat` only.

Confirm action: `savePlan` server action:
- Reads `onboarding_brand_id`.
- Validates with `PlanInputSchema` from Phase 04.
- Inserts into `plans` with `effective_from = now()` and `effective_to = null`.
- Does NOT yet change brand status.

### 4. Step 3 — Payment capture

This is the first Stripe integration. Prefer **Stripe Checkout in embedded mode** over Elements for speed — you get PCI compliance for free and less code.

- [ ] Create a Stripe product "Asaulia Platform" and a price object per slider step (see below for strategy) — or one "metered" product.

**Pricing model with Stripe** (critical decision, follow this):

Use a **single subscription** per brand with two items:
1. **Fixed item:** `price_data` with `recurring: 'monthly'`, unit_amount equal to the current fixed fee in cents. Because the amount varies per brand, create a unique price on the fly with `price_data` or pre-create 10 prices ($99, $199, ..., $1,000) and pick the closest (prefer `price_data` for simplicity).
2. **Variable item:** a metered price that bills per unit based on sales reported at cycle close. Use `billing_scheme: 'per_unit'`, `usage_type: 'metered'`, `unit_amount` = bps as an integer (e.g. for 20% = 2000 bps, unit_amount = 2000 cents). Then the usage reported at period end is `attributed_sales_cents / 10_000`. Alternative: do not use metered billing; instead, issue a separate invoice line item at period close with `stripe.invoiceItems.create({ amount })`. **Recommended:** go with the second alternative — simpler mental model, easier reconciliation.

So:
- Subscription covers the **fixed portion only**.
- Variable portion is added as an invoice item on the upcoming invoice at period close (Phase 11 does this).

Server action `createCheckoutSession`:
- Creates Stripe Customer if absent (`stripe.customers.create`). Save `stripe_customer_id` to brand.
- Creates a subscription checkout session with the fixed price.
- Returns the session's client secret. Render with Stripe embedded checkout.

On checkout success webhook (Phase 11 wires the webhook handler; in this phase create the route at `app/api/webhooks/stripe/route.ts` with a TODO if the full handler isn't ready yet):
- Mark brand `status = 'active'`.
- Save `stripe_subscription_id`.
- Set `billing_cycle_day` to today's day-of-month.
- Redirect user to `/onboarding/complete`.

For this phase, it's acceptable to simulate the "active" transition via a page redirect from Stripe's `return_url`. Harden via webhook in Phase 11.

### 5. Onboarding guard

- [ ] Middleware utility: on each authenticated request, look up the user's `brand_members` → brand status. If `status = 'trial'` and the current path is not under `/onboarding/*`, redirect to the appropriate next step.
- [ ] Conversely, if `status = 'active'` and the path is under `/onboarding/*`, redirect to `/dashboard`.

### 6. Ability to back out

- [ ] Each step has a "Back" button.
- [ ] "Resume onboarding" email after 24 hours of inactivity in a step. Defer to Phase 12 for the email itself — for now, just schedule the job stub.

### 7. UI polish (minimum viable)

- Step progress indicator at the top of each onboarding page.
- Disabled "Continue" buttons while server action is pending.
- Error toasts on validation failures.
- Successful payment shows a celebratory but brief confirmation then auto-forwards in 2 seconds.

### 8. Ensure plan history integrity

- [ ] Add a DB trigger OR a server-side guard: inserting a `plans` row with `effective_to = null` automatically closes any previous open row for the same brand by setting its `effective_to = new.effective_from`.
- [ ] Equivalent behavior via a transaction in `lib/db/plans.ts` is acceptable and preferred (easier to test). Always run the update + insert in a single transaction.

---

## Acceptance criteria

- A user can sign up, complete all three steps, and land on `/dashboard` with:
  - A row in `brands` (`status = 'active'`).
  - A row in `plans` with valid fixed/variable combo.
  - A Stripe Customer + Subscription created.
  - A Stripe Subscription first invoice paid (use test mode + 4242 card in dev).
- Slider only allows values between $99 and $1,000 in $100 steps.
- The displayed variable % always matches `variableFromFixed(fixedCents)` — verified by an E2E test that drags the slider and asserts both values.
- Refreshing the browser mid-onboarding returns to the same step.
- After onboarding, visiting any `/onboarding/*` URL redirects to `/dashboard`.

---

## Tests

Unit (Vitest):
- Form validation for brand fields.
- `savePlan` server action: rejects invalid combos; closes previous plan row atomically when a second one is inserted (use a real local DB via Supabase local, not a mock).

Integration (Playwright):
- Full happy-path onboarding flow on a fresh account with a Stripe test card.
- Refreshing the page on Step 2 after selecting a plan re-renders with the selection preserved (state persisted in cookie + DB).

---

## Notes & gotchas

- **Stripe Customer creation:** idempotent. Use a metadata key `{ brand_id }` so you can dedupe if the action is retried.
- **Webhooks vs return_url:** do NOT trust only `return_url` — webhooks are the source of truth. For Phase 05, we cheat with a return_url-based status flip; Phase 11 fixes this for production.
- **Test card `4000 0000 0000 3155`** triggers 3DS challenge; include this in integration tests to catch SCA issues.
- **Slug uniqueness:** enforced at DB level (`brands.slug` unique). Handle the race condition with a `try/catch` on the unique violation and suggest a suffix.
- **Logo upload:** Supabase Storage with RLS policy `auth.uid() = (storage.foldername(name))[1]` so a user can only write into their own folder. Path convention: `brand-logos/{user_id}/{brand_slug}.{ext}`.

---

## Next phase

`06-deliverables.md` if not yet done — then `07-integrations.md`.

Recommended: do `06` and `07` in that order, then `08` pulls all three together for the client dashboard.
