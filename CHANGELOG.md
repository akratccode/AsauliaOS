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

### Phase 03 — pending
