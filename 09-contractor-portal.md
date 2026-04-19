# Phase 09 — Contractor Portal

## Objective
The contractor-facing app: their task list across all assigned brands, a per-brand view of their work, their earnings breakdown, and their profile/payout settings.

## Depends on
Phase 06 (deliverables). Phase 04 (pricing engine — needed to preview earnings).

## Unlocks
Phase 12 (polish).

---

## Route map

```
app/(contractor)/
├── layout.tsx          # Top nav, notifications, user menu
├── tasks/page.tsx      # All my tasks across brands
├── clients/page.tsx    # Brands I'm assigned to
├── clients/[brandId]/page.tsx   # Per-brand workspace
├── earnings/page.tsx   # Earnings overview
├── earnings/history/page.tsx    # Past payouts
├── profile/page.tsx    # Profile, skills, payout setup
└── onboarding/page.tsx # First-login setup: Stripe Connect
```

---

## Tasks

### 1. Shell

- [ ] Layout similar to client layout but narrower sidebar; contractor palette can be a different accent to signal context.
- [ ] "My earnings projected this period" chip in the top bar — always visible, motivates the contractor.

### 2. Contractor onboarding

Trigger: first login of a user with `global_role = 'contractor'` AND `payout_onboarding_complete = false`.

Steps:
1. **Profile basics:** full name, headline, skills (tag input), preferred timezone.
2. **Payout setup:** Stripe Connect Express onboarding.
   - Server action `startStripeConnectOnboarding`: create or fetch account with `stripe.accounts.create({ type: 'express', capabilities: { transfers: { requested: true } } })`.
   - Generate an onboarding link: `stripe.accountLinks.create({ account, refresh_url, return_url, type: 'account_onboarding' })`.
   - Redirect to Stripe.
   - On return, poll `stripe.accounts.retrieve` until `details_submitted && charges_enabled && payouts_enabled`. Update `contractor_profiles.payout_onboarding_complete = true`.
3. **Tax info:** for v1, rely on Stripe's collection during Connect onboarding. Do not collect W-9/1099 info ourselves.

Without payout setup complete, the contractor can view tasks but not earnings. Show a non-blocking banner on every page until complete.

### 3. Tasks page

Combined view of all `deliverables` assigned to this contractor across brands.

Layout:
- Filters (top row): brand, status (default: not-done), due-date range, type.
- Sort: due date asc (default), brand, value ($) desc.
- List view (one row per task) with:
  - Brand avatar + name
  - Task title + type
  - Status pill
  - Due date (red if overdue, amber if today)
  - **Estimated value to me**: computed as `(fixed_share_bps / 10000) * brand_plan.fixed_amount_cents * 0.40` + a pro-rata share of the variable pool based on current period's attributed sales. Round to dollars for display with a tooltip showing the math.
  - Action menu: open, move to in_progress, move to in_review.

Bulk selection for "Move selected to In progress" is a stretch goal, not required.

### 4. Per-brand workspace

`app/(contractor)/clients/[brandId]/page.tsx`:

- Kanban or list view of this contractor's deliverables for this brand. This is a filtered version of the Kanban from Phase 06.
- Top card: brand details (name, logo), contractor's role label (e.g. "Content lead").
- Period progress card: my deliverables done / total for this period.
- My earnings for this period on this brand (projected).
- Brand's plan shown as: "$299/month + 14.2% variable" — contractor sees the plan so they understand their compensation math. They do NOT see the brand's revenue numbers beyond what's needed for their own variable calc.

### 5. Earnings overview

`app/(contractor)/earnings/page.tsx`:

Current period card:
- Total projected earnings (sum across brands).
- Fixed portion projected.
- Variable portion projected (based on attributed sales so far).
- Pie chart or stacked bar: breakdown by brand.

Per-brand earnings cards (one per assigned brand):
- Brand name + avatar.
- Projected earnings.
- Deliverables contributing (count + share of fixed pool).
- Attributed sales so far (brand-level, non-sensitive aggregate only).

"Next payout" card:
- Date of next payout = brand's billing cycle close + 5 days (the reconciliation buffer).
- Amount locked in at cycle close.

### 6. Earnings history

List of past payouts:
- Date, Period, Amount, Status (paid / processing / failed).
- Click → detail page showing breakdown JSON: which brands, which deliverables, fixed vs variable contribution.
- Download a receipt PDF (Phase 11 generates; Phase 09 links).

### 7. Profile page

- Edit headline, skills, timezone, avatar.
- Re-run Stripe Connect if bank info changed (opens a new onboarding link).
- View current payout status.

### 8. Earnings projection helper

File `lib/contractor/earnings.ts`:

```ts
export async function projectEarningsForPeriod(
  userId: string,
  period: { start: Date; end: Date }
): Promise<{
  byBrand: Array<{
    brandId: string;
    brandName: string;
    fixedSharePoolCents: number;       // 40% of brand's fixed fee
    myFixedShareCents: number;         // my portion of that, based on my deliverables' fixed_share_bps
    variablePoolCents: number;         // 20% of brand's variable (based on attributed sales so far)
    myVariableShareCents: number;      // equal split among contractors assigned to the brand (or weighted if configured)
    totalCents: number;
  }>;
  totalCents: number;
}>
```

Use `distribute()` from the pricing engine. Variable allocation: equal split among active contractors for a brand unless the admin configured per-contractor weights (Phase 10 setting).

---

## Acceptance criteria

- A contractor completes onboarding including Stripe Connect in dev (Stripe Express test mode).
- The tasks page shows only deliverables assigned to them, nothing else.
- Earnings projection updates live as the attributed sales number updates.
- Attempting to change status of a deliverable not assigned to the contractor returns 403.
- A contractor assigned to 3 brands sees all 3 in "clients"; clicking each shows only their work on that brand.
- Payout setup banner disappears after Connect confirms `charges_enabled`.
- Mobile responsive (contractors are often on phones).

---

## Tests

Unit:
- `projectEarningsForPeriod` math: given fixtures of a brand with plan ($299, 14.2%), 10 deliverables (5 mine, 5 others), $5,000 attributed sales, my earnings compute correctly to the cent.

Integration:
- Contractor can move their own task through the allowed transitions.
- Contractor attempting to see another contractor's tasks URL (`?assignee=other_user`) returns empty set (not 403 — silent filter, to avoid enumeration).

---

## Notes & gotchas

- **Stripe Connect Express:** the cheapest Connect option with Stripe handling the dashboard. Good for v1.
- **Variable pool equal split assumption:** we start equal. In Phase 10, admin can set per-contractor weights per brand. Don't over-engineer this phase.
- **PII:** contractors must not see the brand's sale-level data (customer info). They see aggregate attributed totals only.
- **Time-tracking:** explicitly not in v1. If contractors ask, the answer is "track elsewhere; we pay on deliverable completion."
- **Multiple payout accounts:** not supported. One Stripe Connect account per contractor. If a contractor needs to change bank info, update via Stripe Express dashboard.
- **Failed Connect onboarding:** common failure is incomplete address. Our "refresh_url" lets them restart.

---

## Next phase

`10-admin-console.md` — the orchestration layer for Asaulia's team.
