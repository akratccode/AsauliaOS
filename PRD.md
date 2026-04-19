# PRD — Asaulia Platform

## 1. Vision

Asaulia is a growth agency that sells brands a **done-for-you growth subscription**. Instead of buying individual services, a brand subscribes to a plan that combines a fixed retainer with a percentage of sales that Asaulia's work attributably produced. The platform is where this subscription is operated: the brand sees deliverables being produced, the contractors who execute the work see their tasks and earnings, and Asaulia's internal team orchestrates everything.

The differentiator vs. generic project management tools (Asana, Monday, ClickUp) is that **the pricing and revenue flows are native to the product**. Changing a plan, attributing a sale, paying a contractor — all of these are first-class actions in the app.

## 2. Users

### 2.1 Client owner
The person who signed the brand up (founder, CMO, owner). Pays the invoice. Picks and adjusts the plan. Sees deliverables and attributed sales.

### 2.2 Client member
Someone invited by the client owner. Can see deliverables and sales dashboard but cannot change the plan, billing, or team.

### 2.3 Contractor
A freelancer assigned to one or more brands. Sees their tasks, completes deliverables, sees their earnings and payout schedule. Does not see other contractors' earnings or the brand's plan details (only enough to understand their own compensation).

### 2.4 Asaulia admin
Internal team member. Full access. Onboards brands, assigns contractors, monitors finances, resolves disputes.

### 2.5 Asaulia operator (optional sub-role)
A lighter admin that can assign contractors and manage deliverables but cannot change pricing or payouts. Can be implemented in Phase 10 or later.

## 3. Core domain concepts

### 3.1 Brand
The client-side tenant. One owner, many members, one active plan at a time, many assigned contractors, many deliverables, many sales integrations, many invoices.

### 3.2 Plan
Defined by two numbers: `fixed_amount_cents` and `variable_percent_bps` (basis points, so 20% = 2000). Stored as an immutable history — changes create a new row with an effective date. Current plan = latest row with `effective_from <= now`.

Constraints:
- `fixed_amount_cents` ∈ [9900, 100000] (i.e. $99 to $1,000)
- `variable_percent_bps` must match the linear interpolation of `fixed_amount_cents` — computed server-side, never trusted from the client.
- A brand can change its plan at most once per calendar month. Change takes effect next billing cycle, not retroactively.

### 3.3 Deliverable
A unit of work. Has a type (`content_post`, `ad_creative`, `landing_page`, `seo_article`, `email_sequence`, `strategy_doc`, `custom`), a status (`todo | in_progress | in_review | done | rejected`), an assignee (a contractor), a due date, and a `fixed_share_bps` — the share of the fixed fee this deliverable represents in the current period.

**Key rule:** Across all deliverables in a period for a given brand, `fixed_share_bps` should sum to 10000 (100%). The admin assigns these shares when scoping the period.

### 3.4 Sales integration
An adapter to a source of sales data. Types:
- `shopify` — OAuth + order webhooks.
- `woocommerce` — REST API key + scheduled pull.
- `stripe` — Stripe Connect (read-only) for brands whose checkout is Stripe-native.
- `manual` — admin-entered sales with attachment proof (for launch).

Every sale flows in as a `SalesRecord`. Only records marked `attributed = true` count toward the variable fee. Attribution rule: a sale is attributed if it came through a channel Asaulia manages (UTM source in Asaulia's allow-list, or a coupon from Asaulia's catalog, or the whole source is declared "fully attributed" by contract).

There is **no baseline**. Whatever is attributed, is billed. The client chose their plan with this in mind.

### 3.5 Invoice
Generated monthly per brand. Combines the fixed amount for the upcoming month + the variable amount for the closed month (i.e. fixed is billed upfront, variable is billed in arrears). See Phase 11 for the exact cycle.

### 3.6 Payout
Generated monthly per contractor. Aggregates their share of every brand they worked on during the period.

## 4. Non-goals

- **No time tracking** in v1 (can be added later as a contractor convenience).
- **No custom branded portal for each client** in v1 — the client sees Asaulia-branded UI.
- **No AI auto-assignment** of contractors to deliverables in v1. Admin assigns manually.
- **No mobile app** in v1. Mobile web only.
- **No multi-currency** in v1. USD only. (Architecture should not preclude it.)
- **No white-label** in v1.

## 5. Success criteria

### 5.1 Must-have to launch (MVP)

- Brand can sign up, pick a plan on a slider, pay the first fixed amount.
- At least one sales integration (Shopify) works end-to-end.
- Asaulia admin can assign contractors and create deliverables.
- Contractor can complete deliverables and see projected earnings.
- Invoice for fixed + variable is generated and charged via Stripe.
- Contractor payout is computed and can be triggered (manual send is OK for v1, automated is phase-11 stretch).
- Client can view their deliverables Kanban and their sales dashboard.

### 5.2 Quality bar

- All pricing math has unit tests. Zero tolerance for off-by-one cents.
- All money values are integers (cents) end-to-end.
- Permissions checked on every API route, server-side. Never trust the UI.
- Every destructive action has a confirm step and an audit log entry.

## 6. Open product questions (resolve before Phase 11)

These do not block earlier phases but must be answered before billing.

1. **Proration on mid-month signup:** pro-rate first fixed payment based on day-of-month, or charge full and align cycle? **Recommended:** full charge, cycle starts on signup day.
2. **Variable floor on cancel:** if brand cancels mid-month, do they still pay variable on sales attributed up to cancellation? **Recommended:** yes, pro-rata on the days the plan was active.
3. **Failed payment policy:** grace period, retry schedule, freeze of deliverables? **Recommended:** 7-day grace, then freeze, then cancel at 14 days.
4. **Contractor minimum payout:** $0 or a threshold (e.g. $50)? **Recommended:** $50 minimum, carry over if below.
5. **Who absorbs Stripe fees?** Asaulia (reduces margin) or pass-through to brand (add to invoice)? **Recommended:** Asaulia absorbs for v1 simplicity.

Mark these with TODO comments in the code where relevant; come back to them in Phase 11.

## 7. Out of this PRD (known unknowns for later)

- Team billing mode (multiple brands under one legal entity).
- Referral program.
- Public marketing site.
- Contractor skill marketplace (contractors browse open briefs).
- Integrations beyond the four listed in §3.4.
- SSO for enterprise brands.

These are product extensions post-MVP. Do not design around them, but do not paint into a corner either.
