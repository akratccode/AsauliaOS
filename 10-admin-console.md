# Phase 10 — Admin Console

## Objective
Asaulia's operational nerve center. Brand management, contractor roster, assignment matrix, integrations oversight, finance overview, audit log viewer, and configuration. No end-user exposure — internal tool quality.

## Depends on
Phase 05 (onboarding), Phase 06 (deliverables), Phase 07 (integrations), Phase 09 (contractor portal).

## Unlocks
Phase 12 (polish).

---

## Route map

```
app/(admin)/
├── layout.tsx                     # Admin shell
├── page.tsx                       # Overview dashboard (company-wide KPIs)
├── brands/page.tsx                # All brands list
├── brands/[brandId]/
│   ├── page.tsx                   # Brand detail (mirrors client view + admin controls)
│   ├── deliverables/page.tsx      # Kanban with scoping/allocation tools
│   ├── integrations/page.tsx      # (reuse from Phase 07)
│   ├── plan/page.tsx              # Plan history + manual override
│   ├── contractors/page.tsx       # Assigned contractors + weights
│   ├── sales/page.tsx             # All sales with reclassify controls
│   ├── invoices/page.tsx          # Invoices list + generation controls
│   ├── sales/manual/page.tsx      # (reuse from Phase 07)
│   └── audit/page.tsx             # Brand-scoped audit log
├── contractors/page.tsx           # All contractors
├── contractors/[userId]/page.tsx  # Contractor detail, assignments, earnings history, payouts
├── finances/page.tsx              # Company P&L summary
├── finances/payouts/page.tsx      # Payout queue
├── finances/invoices/page.tsx     # All invoices
├── audit/page.tsx                 # Global audit log
└── config/page.tsx                # Feature flags, pricing constants (read-only), env info
```

---

## Tasks

### 1. Admin shell

- [x] `app/(admin)/layout.tsx`:
  - Sidebar: Overview, Brands, Contractors, Finances, Audit, Config.
  - Top bar: search-anything (brand, contractor, invoice ID, deliverable ID).
  - An "impersonate" affordance for admin-only: opens a brand's client view "as if" the admin were that client owner (server-side, logs to audit).

### 2. Overview dashboard

Company KPIs:
- Active brands count, trial brands count, churned this month.
- MRR (fixed) + variable trailing-30d.
- Contractors: active, pending onboarding, payouts pending.
- Integrations health: count active / errored.
- Chart: MRR over the last 12 months.
- Recent events: last 20 entries from `audit_log` across the system.

### 3. Brand detail

Tabs (sub-routes):

**Overview:** everything the client sees on their dashboard, but with admin-only cards added:
- Contribution to Asaulia MRR.
- Contribution to variable billing trailing-30d.
- Projected margin: `asauliaCents / totalRevenueCents` (shows how healthy this client is for us).

**Deliverables:** Kanban + allocation tools:
- A top banner for the current period: "Fixed allocation: 87% assigned, 13% unassigned. Assign or accept the variance."
- Drag-to-resize `fixed_share_bps` via a small slider on each card (inline edit; debounced save).
- Bulk actions: "Create period" (copy last month's deliverables as templates), "Roll over open deliverables to next period."

**Plan:** plan history + admin manual override:
- Admin can set a plan with `effective_from = arbitrary`, with a required audit reason.
- Admin can bypass the cooldown.

**Contractors:** assignment matrix and per-contractor weights:
- List of assigned contractors with role label, start date, status.
- Weights grid: for each contractor, a `variable_share_bps` input used in the variable pool distribution. Default = equal split (`10000 / N`). Admin overrides with any non-negative bps values; the system normalizes to sum to 10000 on save. Store in a new table `brand_contractor_weights`:
  - `id`, `brand_id`, `contractor_user_id`, `period_start`, `period_end`, `variable_share_bps`.
  - Unique on (brand_id, contractor_user_id, period_start).

**Sales:** list with reclassify controls from Phase 07 + an entrypoint to manual sales entry.

**Invoices:** same as client view + admin actions:
- "Generate draft invoice for current period" (manually triggers what Phase 11 does automatically).
- "Void and reissue" for paid-in-error cases (rare, audited).

**Audit:** audit_log filtered for this brand.

### 4. Contractors roster

`app/(admin)/contractors/page.tsx`:

- Table: name, email, status, onboarding complete, # assignments, # deliverables in flight, earnings last period.
- Filters: status, skills, has-payout-setup.
- Search.
- Actions per row: view, pause, resume, remove (soft — sets status, keeps history).

`app/(admin)/contractors/[userId]/page.tsx`:

- Profile info.
- Assignments across brands (with start/end dates).
- Earnings history (all payouts).
- Deliverables history + performance stats (avg completion time, rejection rate, on-time %).
- Danger zone: unassign from all brands, pause account.

### 5. Assignment matrix

Admins need to quickly see: which contractor is on which brand, and vice versa.

Add a dedicated page `app/(admin)/contractors/matrix/page.tsx`:
- Rows: active contractors. Cols: active brands.
- Cells: role label if assigned; blank if not.
- Click a blank cell to open "Assign" dialog (contractor + brand + role + start date).
- Click an assigned cell to edit or unassign.
- Search/filter by skills to narrow rows.

### 6. Finances

`finances/page.tsx`:
- P&L summary: revenue (fixed + variable) − contractor pool = Asaulia margin. By month, by brand, totals.
- Outstanding invoices (past due).
- Upcoming scheduled payouts (next N days).
- Export to CSV.

`finances/payouts/page.tsx`:
- Queue of pending payouts.
- Bulk action: "Send all pending" triggers the payout job from Phase 11 (with confirmation).
- Per-payout detail showing the breakdown JSON.
- Resend for failed payouts.

`finances/invoices/page.tsx`:
- All invoices across brands with filters.
- Quick filters: "Past due", "This month", "Failed".

### 7. Audit log viewer

`audit/page.tsx`:
- Paginated global view with filters: actor, entity_type, action, date range, brand.
- Entity ID search.
- Click an entry to see before/after diff rendered as a readable JSON view.
- Export-to-CSV for compliance.

Retention: default 2 years.

### 8. Config page

Read-only view of:
- Current pricing constants (from `lib/pricing/constants.ts`).
- Current env (non-secret keys shown; secret keys shown as fingerprints).
- Feature flags (PostHog-backed): listed with on/off state.
- Version info (commit hash from Vercel env).

### 9. Impersonation

Low-priority but useful:

- Admin clicks "Impersonate as client owner" on a brand.
- Server sets a short-lived cookie `impersonate_user_id` (15 min).
- Middleware detects cookie; overrides `authorize()` to return the impersonated user's context.
- Every request made under impersonation is tagged in audit_log with `actor = admin_user_id` and `on_behalf_of = target_user_id`. The impersonated user is NEVER recorded as the actor.
- A persistent banner at the top of the app: "Impersonating Alice @ BrandOne — Exit."

Writes during impersonation are blocked by default; the admin must explicitly enable "allow writes" on a per-session basis, and every write logs both users. Recommended to keep writes off in v1 and only use impersonation to debug viewing issues.

### 10. Bulk actions & data tools

Several internal-ops helpers exposed as admin-only routes:

- Reindex sales attribution across all integrations for a brand.
- Recompute contractor distribution for a closed period (with audit trail).
- Export a brand's full data as a zip for GDPR-style requests.

---

## Acceptance criteria

- Admin can land on `/admin` and see current business state in under 3 seconds.
- All admin writes (plan override, manual sale, payout trigger, impersonation) create audit_log rows with actor, before, after, IP, user-agent.
- Assignment matrix handles 100+ contractors × 100+ brands without perceptible slowdown (virtualize the grid if needed).
- Manual invoice generation produces identical numbers to the automated job from Phase 11 when run on the same period — verified by a unit test that runs both and diffs.
- Impersonation banner is always visible while active and cannot be dismissed.

---

## Tests

Unit:
- Contractor weight normalization (given a vector summing to any number, output sums exactly to 10000).
- Audit log diff renderer produces expected output for a sample before/after.

Integration:
- Admin creates a brand, onboards it, assigns contractors, creates deliverables, flips statuses, triggers invoice generation — all in one Playwright flow.

---

## Notes & gotchas

- **Search-anything bar:** use a simple `ILIKE` over brand names, contractor names, and a UUID prefix match on invoice/deliverable IDs. Postgres `pg_trgm` extension makes this fuzzy and fast; enable it in a migration.
- **Grid performance:** use `@tanstack/react-virtual` for the assignment matrix.
- **Permissions:** everything in this phase is admin/operator only. Triple-check every server action calls `requireRole(['admin', 'operator'])` — a missing guard here is catastrophic.
- **Operator role limits:** operators cannot see contractor payout amounts, cannot change plans, cannot trigger payouts. They can manage deliverables, integrations, and assignments.
- **Rate-limit manual sale entry:** trivially abusable. Cap at 100 entries per admin per day, non-configurable.

---

## Next phase

`11-billing-payouts.md` — close the financial loop.
