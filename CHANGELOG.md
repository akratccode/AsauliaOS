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

### Phase 04 — pending
