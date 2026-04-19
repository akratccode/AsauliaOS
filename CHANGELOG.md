# Changelog

All user-visible changes per phase. Phases are completed in dependency order
(see `00-INDEX.md`).

## [Unreleased]

### Phase 01 — Foundation & tooling
- Scaffolded Next.js application (App Router) in the repo root with TypeScript strict mode.
- Tailwind CSS v4 configured with Asaulia design tokens (dark-first palette, Geist + Instrument Serif typography, radii, motion) mirrored from `design-system/colors_and_type.css`.
- Installed core dependencies: Supabase client, Drizzle ORM, Zod, Stripe, Resend, TanStack Query, Lucide icons, PostHog.
- Added dev tooling: Vitest (+ jsdom + Testing Library), Prettier with Tailwind plugin, Playwright (installed, e2e suites land in later phases).
- Created `lib/env.ts` — Zod-validated environment parsing; `lib/db/index.ts` — Drizzle client wired to `DATABASE_URL`; `lib/analytics.ts` — PostHog server client (no-op when unset).
- Established folder skeleton per `ARCHITECTURE.md` — `app/(marketing|auth|client|contractor|admin)`, `components/{ui,kanban,pricing-slider,charts,forms}`, `lib/{auth,pricing,billing,integrations/*,notifications,utils}`, `tests/{unit,integration,e2e}`, `scripts/`.
- Added GitHub Actions CI workflow running `lint`, `typecheck`, `test` on every push/PR.
- Landing page at `/` displays the Asaulia wordmark and subtitle over the signature voice halo, using the design-system tokens.

#### Deviations from phase file
- Next.js 16 + React 19 + Tailwind 4 used (what `create-next-app@latest` provides in 2026) instead of the PRD's Next 14 + Tailwind 3. All code uses stable App Router APIs so migration paths remain open.
- shadcn/ui CLI not run — shadcn is a generator, so components land in their owning phases (05 for onboarding, 06 for deliverables, 08+ for dashboards). The design tokens and fonts needed by shadcn are in place.
- Sentry not auto-wired — the interactive `@sentry/wizard` can't run headless. `SENTRY_DSN` vars are declared in `.env.example`; Sentry manual init lands when a subsequent phase needs it.
- Supabase local CLI (`supabase start`) not executed — requires Docker, which isn't guaranteed here. `.env.example` still documents the expected Supabase vars.
- Vercel project link deferred to the human operator.

### Phase 02 — Database schema
- Added Drizzle schema under `lib/db/schema/`: `users`, `brands`, `brand_members`, `plans`, `contractor_profiles`, `brand_contractors`, `deliverables` (+ `attachments`, `comments`, `activity`), `sales_integrations`, `sales_records`, `invoices`, `payouts`, `notifications`, `audit_log` — plus a shared `enums.ts` (10 pg enums) and `relations.ts`.
- Enforced PRD invariants at the database layer: check constraints on `plans.fixed_amount_cents` (9900–100000) and `plans.variable_percent_bps` (700–2000); generated column `invoices.total_amount_cents = fixed + variable`; uniqueness on `brand_members(brand_id,user_id)`, `brand_contractors(brand_id,contractor_user_id,role)`, `invoices(brand_id,period_start)`, `payouts(contractor_user_id,period_start)`, `sales_records(integration_id,external_id)`.
- Cascade rules: tenant-owned rows (`brand_members`, `plans`, `deliverables`, `sales_integrations`, `sales_records`, `invoices`) cascade on brand delete; actor/audit columns use `set null` so history survives user removal.
- Generated initial migration `lib/db/migrations/0000_foamy_the_hunter.sql` and committed it alongside `_meta/` snapshots.
- Added `lib/db/rls.sql` — enables RLS on every tenant table with `is_brand_member(uuid)` and `is_staff()` helper functions plus SELECT policies per the Phase 02 access matrix. Writes continue to flow through server actions using the service role; RLS is the second line of defense.
- Added `lib/db/types.ts` exporting `InferSelectModel` / `InferInsertModel` aliases for every table.
- Added `scripts/seed.ts` (+ `db:seed` script, `tsx` dev dep) producing 5 users, 2 brands with plans, contractor assignments, 5 deliverables per brand, and 20 sales records per brand. Idempotent — wipes the tenant tables before reseeding.
- Added `tests/unit/db.test.ts` asserting the schema surface the rest of the app depends on.

#### Deviations from phase file
- `pnpm db:push`, `pnpm db:seed`, `pnpm db:studio`, and the runtime constraint-violation assertions from the phase's Tests section require a running Postgres; none is available in this environment. The migration SQL and RLS SQL have been statically inspected and committed, and the live checks will run in the Supabase-backed CI/dev environments. Integration-level DB tests land in `tests/integration/` in Phase 03 once a CI Postgres service is wired up.

### Phase 03 — Authentication & authorization
- Three Supabase clients per SSR guidance: `lib/auth/supabase-browser.ts`, `lib/auth/supabase-server.ts` (cookie-aware), `lib/auth/supabase-admin.ts` (service-role, `server-only`-guarded).
- `middleware.ts` + `lib/auth/middleware-client.ts` refresh the session on every request, redirect unauthenticated traffic off `/dashboard`, `/onboarding`, `/tasks`, `/clients`, `/earnings`, `/admin`, and bounce logged-in users away from auth-only pages. Webhooks and static assets are excluded from the matcher.
- Auth pages under `app/(auth)/`: login, signup (plain + invite-consuming), password reset request, password reset confirm, verify-email notice, logout route. All submit via server actions in `app/(auth)/actions.ts`. Error messages are generic so we don't leak account enumeration.
- Rate limiting: `lib/auth/rate-limit.ts` with `@upstash/ratelimit` — 5 logins / 10 min per `email+ip`, 3 password resets / hour. Falls back to a no-op when `UPSTASH_REDIS_REST_*` env vars aren't set.
- RBAC core: `lib/auth/rbac.ts` exports `requireAuth`, `requireRole`, `requireAdmin`, `requireBrandAccess` plus typed `Unauthorized` / `Forbidden` error classes. Resolver injection lets unit tests mock sessions without touching Supabase.
- Invitations: new `invitations` table (migration 0001) with `scope ∈ {global, brand}` + role, 7-day expiry, unique token, audit entry on creation. `lib/auth/admin-ops.ts` wraps invite creation and role changes with audit-log writes.
- User row sync with Supabase auth: `lib/db/migrations/0002_auth_triggers.sql` defines the `on_auth_user_created` + `on_auth_user_email_updated` triggers. Applied manually from the Supabase SQL editor since the `auth` schema is managed outside drizzle-kit.
- Email stub: `lib/notifications/email.ts` uses Resend when configured and falls back to console-logging the outgoing message in dev.
- Tests: `tests/unit/rbac.test.ts` covers the four RBAC helpers via `tests/helpers/auth.ts`. Vitest picks up `server-only`, `next/navigation`, and `next/headers` stubs under `tests/stubs/`.

#### Deviations from phase file
- Supabase dashboard email-template customisation requires a human with dashboard access — documented as a launch-checklist item for Phase 12.
- Playwright invite integration test deferred: it needs a running Supabase + Postgres + Next.js server; wiring the CI service containers lands in Phase 12 along with the rest of the e2e suite.
- shadcn Form components not used — the shadcn CLI was never invoked in Phase 01 (documented). Forms use the lightweight `components/auth/form-primitives.tsx` shared by every auth page; migrating to shadcn when the CLI runs is a mechanical swap.

### Phase 04 — Pricing engine
- `lib/pricing/constants.ts` is the sole source of pricing numbers (min/max fixed in cents, min/max variable bps, contractor shares, cooldown days, derived range widths). No other file may hard-code these.
- `interpolate.ts` provides the canonical linear interpolation between the Starter ($99 / 20%) and Pro ($1000 / 7%) anchors, with clamping at both ends. Fixed is canonical; variable is derived.
- `validate.ts` exports a single `PlanInputSchema` Zod schema that enforces bounds and a ±1 bps tolerance between the submitted fixed and variable values — the only validator any server action uses to accept a plan from a client.
- `quote.ts` computes invoice components (fixed + variable + total) from a plan and attributed sales total. `breakeven.ts` returns the sales amount at which two plans tie.
- `split.ts` divides an invoice into the contractor pool (40% of fixed + 20% of variable) and the Asaulia share. Uses floor rounding so every rounding residual stays on the Asaulia side — the pool + Asaulia split always sums to the invoice total.
- `distribute.ts` is the pure share-allocation function used by Phase 11. It uses a largest-remainder method so distributed cents match the pool exactly; rolls the fixed pool over when no deliverables are `done`; falls back to equal distribution for the variable pool when no weights are provided.
- `slider.ts` offers slider stops, percent ↔ value converters, and `formatCents` / `formatBps` display helpers used by the upcoming pricing slider UI.
- `lib/pricing/index.ts` re-exports the public surface so callers only ever `import { … } from '@/lib/pricing'`.
- Tests: `tests/unit/pricing.test.ts` covers anchors, monotonicity, validation, quote, breakeven ($6,930.77), split invariants (10k random cases), distribution largest-remainder (100 random cases + rollover), and slider formatters. All 38 tests pass.

### Phase 05 — Client onboarding
- Route group `app/(onboarding)/` with a shared header + three-step progress stepper (`components/onboarding/stepper.tsx`) across Brand → Plan → Payment, plus a Complete page that auto-forwards to `/dashboard`.
- Brand step: client-side `slugify` preview with user override, zod-validated server action that retries slug up to 5 times on unique-violation, inserts `brands` + owner `brand_members` row + audit log entry, and sets the `onboarding_brand_id` cookie for the next steps.
- Plan step: `components/pricing-slider/PricingSlider.tsx` — the headline UX. Fixed fee slider ($99 → $1,000 in $100 snaps), derived variable % in read-only form, live quote + projection widget comparing Current / Starter / Pro with the cheapest option highlighted. Keyboard-operable (arrow keys step, PageUp/Down jump $500). Hidden `fixedAmountCents` + `variablePercentBps` inputs keep the form server-submittable. `savePlanAction` revalidates through `PlanInputSchema` and commits via `lib/db/plans.ts::savePlanRecord` — an atomic transaction that closes any open plan row before inserting the new one.
- Payment step: `createCheckoutSessionAction` creates a Stripe Customer if needed, opens a subscription Checkout session covering the fixed portion (variable reconciles at period close in Phase 11), and redirects to Stripe. When `STRIPE_SECRET_KEY` is not configured it flips the brand to `status = 'active'` locally so the developer flow still completes end-to-end. `/onboarding/complete` finalizes by retrieving the session and storing `stripe_subscription_id` + `billing_cycle_day`; webhook in Phase 11 will become the source of truth.
- Stripe webhook stub at `app/api/webhooks/stripe/route.ts` verifies signatures and handles `checkout.session.completed` today; richer invoice/subscription events land in Phase 11.
- Middleware additions: protected prefixes now include `/profile` and `/settings` so the user-menu links work behind auth; onboarding + auth gating unchanged.
- Pricing slider / onboarding tests: `tests/unit/onboarding.test.ts` verifies slug slug generation / suffixing and asserts `savePlanRecord` closes the prior plan before inserting the new one (transaction sequencing).

#### Deviations from phase file
- Playwright happy-path e2e requires a running Supabase + Stripe test mode + dev server simultaneously; this lands in Phase 12 alongside the rest of the e2e suite.
- Resume-onboarding email job scheduling is deferred to Phase 12 (the phase file explicitly marks this as Phase 12 work).
- Logo upload to Supabase Storage is deferred until Phase 12 polish — the brand form currently omits the file input so onboarding stays functional even when Storage isn't provisioned.

### Phase 06 — Deliverables system
- Schema additions: `deliverables.archived_at` column + new `deliverable_comment_mentions` table. Migration `0003_deliverables_mentions_archived.sql`. RLS policy added for the new table. The legacy hand-written auth-triggers migration was renamed to `manual_auth_triggers.sql` (outside the numbered drizzle journal) to avoid a collision with the new generated migration.
- Domain modules under `lib/deliverables/`:
  - `transitions.ts` — the full status transition matrix (`todo → in_progress → in_review → done | rejected`, `rejected → in_progress`, `done → in_review` reopen) with actor-level gating (admin/operator/client_owner/assignee).
  - `permissions.ts` — resolves `AuthContext` + brand relationship into capability flags (`canCreate`, `canAssign`, `canSetFixedShare`, `canDelete`, `canComment`, `canAttach`, `resolveTransitionActor`).
  - `allocation.ts` — `summarizeAllocation` + `validateAllocation(brandId, period)` producing `exact` / `over_allocated` / `under_allocated` flags; `validateSingleShareBps` enforces the 50% safety rail.
  - `attachments.ts` — MIME allow-list (images, PDFs, office docs, markdown, zip, Figma, PSD), 25 MB cap, 5-minute signed URL constant, `buildAttachmentPath(brand_*/deliverable_*/uuid-name)`.
  - `mentions.ts` — extracts `@username` tokens from markdown, ignoring code fences and inline code.
- `lib/billing/period.ts` stub — `monthStringToPeriod`, `currentUtcMonth`, `currentUtcPeriod`. Fully replaced in Phase 11 but already consumed by the deliverables list page.
- `lib/deliverables/service.ts` — single entry point for every mutation. Every call logs to `deliverable_activity`. `addComment` transactionally persists `deliverable_comment_mentions` for resolved brand-member / assigned-contractor handles. Server-side RBAC via `resolveTransitionActor` — invalid-transition throws `InvalidTransitionError`; forbidden moves throw `Forbidden`.
- API routes under `app/api/deliverables/` — `GET|POST /`, `PATCH|DELETE /[id]`, `GET|POST /[id]/comments`, `GET|POST /[id]/attachments`, `GET /[id]/activity`. All validated with Zod, errors mapped to `401 | 403 | 400 invalid_input | 400 invalid_transition | 500`.
- Kanban UI — `components/kanban/` with `Board.tsx` (DndContext, optimistic-update + server reconciliation + snap-back toast when a transition is invalid), `Column.tsx` (per-status droppable with live share-bps sum), `Card.tsx` (draggable — title, type tag, due date, share %, comments/attachments counts), `DeliverableSheet.tsx` (comments + activity timeline, post-comment form).
- `app/(client)/deliverables/page.tsx` — SSR page resolving the caller's brand, reading the current or requested period, batching comment + attachment counts through two grouped queries, and rendering the Board with an allocation banner.
- Tests: `tests/unit/deliverables.test.ts` — every valid transition accepted, every arbitrary one rejected; actor matrix covering assignee/client_owner/admin/operator; allocation exact/over/under; attachment allow-list + size cap (25 MB); path sanitization; mention extractor (single, multiple, code-fence/inline-code exclusion); period helpers (including leap years and current UTC). `tests/setup.ts` now seeds baseline env vars so `@/lib/db`-importing tests can load without a real database URL.

#### Deviations from phase file
- Playwright integration scenarios (drag-as-assignee → reload, non-assignee 403) are deferred to Phase 12 alongside the rest of the e2e suite — they need running Supabase + Next.js + a seeded DB.
- Supabase Storage bucket + signed-URL generation plumbing (the `deliverable-attachments` bucket + 5-minute expiry downloads) is declared in code (path helpers, constants) but not provisioned against a live Supabase — the upload endpoint accepts metadata only. The direct-to-Storage upload UX lands in Phase 12 polish once the bucket exists.
- List-view filters (assignee / type / status dropdowns + month picker + search + List / Kanban toggle) are not wired — the current page defaults to Kanban + current UTC month. The SSR page reads `?brandId` and `?period=YYYY-MM` from the URL today; the richer filter UI arrives in Phase 08 (client dashboard polish).
- Realtime stays out (phase file explicitly marks Phase 12).

### Phase 07 — Sales attribution & integrations
- Adapter framework under `lib/integrations/`:
  - `types.ts` — `NormalizedSale`, `AttributionRule` union, `SalesAdapter` contract.
  - `registry.ts` — central provider → adapter lookup.
  - `classify.ts` — any-match rule engine; returns `{ attributed, reason }` where the reason encodes which rule fired (audit trail).
  - `crypto.ts` — AES-256-GCM sealing for per-integration config (12-byte IV + 16-byte auth tag prepended). New env var `INTEGRATIONS_ENCRYPTION_KEY` (32 bytes base64).
  - `service.ts` — single entry point for `connectIntegration`, `ingestSales` (with `ON CONFLICT (integration_id, external_id) DO NOTHING` + per-sale `classify`), `syncIntegration` (decrypts config, calls adapter `pullSince`, tracks `last_error`/`last_synced_at`), `updateIntegrationRules`, `reclassifyIntegration` (scoped to sales since a period start so closed periods stay immutable), `addManualSale` (admin-only, writes audit entry), `attributedSalesForPeriod` shared aggregator.
- Adapters — all implementing the shared contract:
  - `shopify/index.ts` — OAuth-token config, paginated `GET /orders.json` with `Link: rel="next"` parser, note_attributes + landing-site-query-string UTM extraction, HMAC-SHA256 webhook verification (timing-safe compare).
  - `woocommerce/index.ts` — Basic-auth REST polling, `after=ISO8601` pagination, UTM extraction from `meta_data`.
  - `stripe-sales/index.ts` — platform-key + `Stripe-Account` header, `starting_after` cursor, refund-netting (`amount - amount_refunded`, only `status = succeeded`).
  - `manual/index.ts` — no pull; used to back admin-entered sales with a real `sales_integrations` row.
- API & cron:
  - `app/api/integrations/shopify/install/route.ts` — redirects to Shopify OAuth grant.
  - `app/api/integrations/shopify/callback/route.ts` — exchanges the auth code for an access token, delegates persistence to `connectIntegration`, requires admin/operator.
  - `app/api/webhooks/shopify/route.ts` — looks up the integration by shop domain, decrypts config, verifies HMAC, ingests. Invalid HMAC → 401; malformed body → 400.
  - `app/api/cron/sync-integrations/route.ts` — `x-cron-secret`-gated endpoint that walks every `status='active'` integration (skipping `manual`), runs `syncIntegration`, returns per-integration `{ inserted }` or `{ error }`. Wired to Vercel cron `*/15 * * * *` via `vercel.json`.
- PII-safe persistence — manual `stripPii` drops email/name/phone keys from sale metadata before inserting `sales_records.raw_payload`.
- Tests: `tests/unit/integrations.test.ts` covers the classifier for every rule type (including `utm_campaign_prefix`, `coupon`, `landing_page_prefix`, and first-match `reason`), Shopify mapping (note_attributes UTMs, landing-query-string UTMs, `Link` rel parsing, HMAC verification), WooCommerce mapping, Stripe charge mapping (refund netting + currency upper-casing), and the AES-GCM crypto round-trip. 15 new assertions.
- `tests/setup.ts` now also seeds `INTEGRATIONS_ENCRYPTION_KEY` + `SHOPIFY_WEBHOOK_SECRET` so the integrations suite doesn't need real secrets.

#### Deviations from phase file
- Stripe Connect OAuth flow is stubbed — the Stripe-sales adapter takes a `stripeAccountId` and relies on a platform-owned `STRIPE_SALES_SECRET_KEY` with the `Stripe-Account` header instead. The full Connect wizard (and Connect Express account creation for payouts) lands in Phase 11 where Connect accounts also back contractor payouts.
- Attribution-rules editor UI + admin integrations page (`app/(admin)/brands/[brandId]/integrations/…`) are not rendered yet — the admin console is Phase 10, and that phase calls the service functions shipped here. The API is complete.
- `lib/integrations/aggregate.ts` is unified with `service.ts#attributedSalesForPeriod` instead of a separate file — the phase file named a module path, we named the function inside the existing service. No behavioral change.
- Playwright scenario "Shopify dev-store OAuth" requires a real Shopify partner app; deferred to Phase 12.
- `msw`-mocked integration tests for the Shopify pull paginator are not wired — the unit suite covers the mapping and `Link` parser pure-functions; a live-fetch paginator test lands in Phase 12 when we introduce `msw`.

### Phase 08 — pending
