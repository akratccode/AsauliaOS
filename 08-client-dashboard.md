# Phase 08 — Client Dashboard

## Objective
The brand owner's primary experience: an at-a-glance dashboard, deliverables view, sales tracking, invoice history, and a plan-adjustment page with the slider from Phase 05. This is the UX that justifies the subscription — make it feel like a growth cockpit, not a project tool.

## Depends on
Phase 05 (onboarding + plan change logic), Phase 06 (deliverables), Phase 07 (sales integrations).

## Unlocks
Phase 12 (polish).

---

## Route map

```
app/(client)/
├── layout.tsx                     # Top nav with brand switcher, user menu, notifications
├── dashboard/page.tsx             # Monthly overview
├── deliverables/page.tsx          # Kanban + list (already built in Phase 06)
├── deliverables/[id]/page.tsx     # Detail page (alternative to side sheet — deep link)
├── sales/page.tsx                 # Sales dashboard
├── sales/[saleId]/page.tsx        # Individual sale detail (admin-like, for transparency)
├── plan/page.tsx                  # View current plan + adjust slider
├── plan/history/page.tsx          # Plan change history
├── billing/page.tsx               # Invoice history + next invoice preview
├── billing/[invoiceId]/page.tsx   # Invoice detail (download PDF from Stripe)
├── team/page.tsx                  # Brand members management (owner only)
└── settings/page.tsx              # Brand settings (logo, timezone, etc.)
```

---

## Tasks

### 1. Shell & navigation

- [ ] `app/(client)/layout.tsx`:
  - Left sidebar on desktop, bottom nav on mobile.
  - Nav items: Dashboard, Deliverables, Sales, Plan, Billing, Team, Settings.
  - Top bar: brand switcher (if user owns multiple brands), notifications bell, user menu.
  - Current billing period indicator: "Period: Oct 15 – Nov 14".
- [ ] Empty state: if user's brand is brand-new and no deliverables exist yet, show a warm welcome with CTA "Your team will start delivering within 48 hours".

### 2. Dashboard page

Hero section:
- Current period stats in 4 metric cards:
  1. **Days left in period** (e.g. "12 of 30").
  2. **Deliverables progress** (e.g. "8 of 12 completed").
  3. **Attributed sales this period** (e.g. "$4,230").
  4. **Projected total invoice next close** (fixed + estimated variable at current pace).

Below:
- **Deliverables summary:** a compact version of the Kanban columns showing counts and a click-through CTA to the full view.
- **Sales trend chart:** a line chart of daily attributed sales for the period (Chart.js). Compare to last period if we have one.
- **Recent activity:** 5 most recent items across deliverables (comments, approvals, assignments).

Data is fetched via a single server component on page load (`getDashboardData(brandId, period)`) to avoid waterfalls.

### 3. Sales page

Layout:
- Top: Summary cards — attributed sales period-to-date, conversion vs last period %, # of attributed orders, avg order value.
- Middle: A time series chart, with toggles for "This period" / "Last 30 days" / "Last 90 days" / "All time".
- Bottom: Sales table with columns:
  - Date, Source (integration display name), Amount, Attribution (attributed? reason), Customer hash (partial, for identification without PII).
- Filters: integration, attribution (all / attributed / unattributed), amount range.
- Paginated (20 per page); export-to-CSV link (generates via a server action that streams CSV).

Transparency principle: the client can see **every** sale and exactly why it was (or wasn't) attributed. No black box.

### 4. Plan page

Current plan card:
- Big number: current fixed amount + variable %.
- "Your plan = $299/month + 14.2% of attributed sales. Next invoice close: Nov 14."

Adjust plan section:
- The same slider component as Phase 05 (`PricingSlider`), but this time:
  - Shows the current value by default.
  - Warns if the user would be hitting the cooldown: "Plan last changed 8 days ago. You can change again on Nov 20." Slider locked in that case.
- Projection uses this period's actual sales as the baseline.
- Save button opens a confirmation dialog: "Moving from $299 + 14.2% to $499 + 9.5%. Effective from the start of your next billing period (Nov 15). You keep the current plan until then."
- On confirm, server action `changePlan`:
  - Validates cooldown (`PRICING.PLAN_CHANGE_COOLDOWN_DAYS`).
  - Validates the new combo via `PlanInputSchema`.
  - Inserts a `plans` row with `effective_from = nextBillingCycleStart`.
  - Does NOT close the current plan row yet (`effective_to` set by the cycle-close job in Phase 11, or by a trigger when the new row's `effective_from` is reached).
  - Writes audit log.
  - Notifies the user via email + in-app toast.

Plan change cannot reduce the current cycle's variable rate — the rate for the closing cycle is always the plan that was active at its start.

### 5. Plan history page

Chronological list of plan rows for the brand:
- Columns: Effective from, Effective to (or "Current"), Fixed, Variable, Changed by.
- Read-only. Useful for audit and for the client to see their own history.

### 6. Billing page

- **Next invoice preview card:** projected total = current fixed + (current variable % * attributed sales so far). Updates live-ish (on each page load; fine for v1).
- **Payment method card:** show card brand + last 4, expiry. "Update" button opens Stripe Customer Portal (`stripe.billingPortal.sessions.create`).
- **Invoice history:** table of past invoices with status, download PDF (link to Stripe-hosted PDF URL), amount, date.
- Failed-payment callout with action: "Update payment method to resolve."

### 7. Invoice detail page

Server-side renders the invoice by querying our `invoices` table + fetching the Stripe-hosted details for the PDF link. Shows:

- Line items: Fixed fee, Variable fee (with sales basis).
- Attributed sales list used to compute the variable fee (same sales shown as a sub-table).
- Split-aware note (client-facing, tasteful): "Your subscription supports X growth contractors working on your brand." No dollar amounts of contractor pay — private.

### 8. Team page

For brand owners only:

- List of current members with role and status.
- "Invite member" button → opens a dialog, submits to invite flow from Phase 03.
- Pending invites list with "Resend" and "Revoke".
- Owner cannot remove themselves; they must transfer ownership first (defer transfer to Phase 12 unless trivial).

Client members see only their own membership, no management.

### 9. Settings page

- Brand name, logo, website, timezone — editable.
- Danger zone: "Pause subscription", "Cancel subscription" — both open a confirm dialog and explain consequences. Pause suspends deliverables; Cancel ends at the close of the current period (no refunds for paid fixed, variable prorated to cancellation date — Phase 11 handles the math).

### 10. Brand switcher

If a user is a member of multiple brands, the top nav includes a switcher.

- Dropdown with all brands the user belongs to.
- Switching updates a cookie `active_brand_id` which middleware reads.
- All routes under `(client)` use this cookie to scope queries.
- If only one brand, hide the switcher.

### 11. Notifications bell (lightweight)

In Phase 12 we fully implement notifications, but for this phase:
- Show unread count on the bell.
- Click opens a dropdown with last 10 items from `notifications` table for the current user.
- Items link to the relevant entity (deliverable, invoice, etc.).
- "Mark all as read" button.

---

## Acceptance criteria

- A client can visit `/dashboard` and see their brand's live state (deliverables, sales, projected invoice).
- Plan slider enforces cooldown and interpolation rules.
- Sales table filters and exports to CSV correctly.
- Team invites round-trip (send → accept → appears in members list).
- All pages render in < 500ms with a representative brand (50 deliverables, 500 sales).
- Every page is mobile-responsive (test at 375px width).
- Dark mode looks intentional, not just "light colors inverted."

---

## Tests

Unit:
- `getDashboardData` returns correct aggregates for a fixture brand.
- `changePlan` rejects within cooldown with the right error.
- CSV export streams expected headers + rows.

Integration (Playwright):
- Client user logs in → sees dashboard with correct period dates.
- Client changes plan, sees confirmation, observes current plan unchanged until next cycle.
- Client with multiple brands can switch, and each brand's data is isolated (no leakage).

---

## Notes & gotchas

- **Cache invalidation:** use Next's `revalidatePath()` on the relevant paths after any mutation. Don't rely on refetching — it's slower and flickers.
- **Data freshness:** dashboard data can be stale by up to 15 minutes (the sales sync cadence). Add a subtle "Last synced" indicator on the sales card.
- **Time ranges across DST:** use `date-fns-tz` for any operation that converts between brand timezone and UTC. DST transitions silently shift period boundaries if you use naive `Date` math.
- **Invoice preview lag:** on page load, freshly synced sales might not be reflected for a few seconds after a Shopify webhook. Acceptable; dashboard is not a real-time POS.
- **Brand switcher persistence:** cookie expires in 30 days; on expiry, middleware picks the brand where the user was most recently active.

---

## Next phase

`09-contractor-portal.md` — the other side of the marketplace.
