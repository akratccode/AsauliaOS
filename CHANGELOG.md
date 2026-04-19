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

### Phase 02 — pending
### Phase 03 — pending
