# Architecture

## Stack (contractual — do not change without explicit approval)

| Layer | Choice | Why |
| ----- | ------ | --- |
| Framework | Next.js 14 (App Router) | SSR, server actions, first-class TS. |
| Language | TypeScript, strict mode | Non-negotiable. |
| Styling | Tailwind CSS + shadcn/ui | Utility-first + accessible primitives. |
| Database | PostgreSQL via Supabase | Managed, RLS available, realtime built-in. |
| ORM | Drizzle | Type-safe, migration-native, fast. |
| Auth | Supabase Auth | Integrated with DB RLS. |
| Payments | Stripe (subscriptions + Connect) | Industry standard; Connect for contractor payouts. |
| File storage | Supabase Storage | Same project; policies integrated. |
| Email | Resend | Great DX, React Email templates. |
| Validation | Zod | Runtime + TS inference. |
| Data fetching (client) | TanStack Query | Cache, retries. |
| Server state | Server Actions + `fetch` | Keep it simple. |
| Error monitoring | Sentry | Free tier is enough for v1. |
| Analytics | PostHog | Product analytics + feature flags. |
| Package manager | pnpm | Workspace-friendly. |
| Deployment | Vercel + Supabase Cloud | Both have generous free/startup tiers. |
| CI | GitHub Actions | Basic: lint, typecheck, test, deploy preview. |

## Folder structure (single Next.js app — no monorepo in v1)

```
.
├── app/                      # Next.js App Router
│   ├── (marketing)/          # Public pages (landing, pricing)
│   ├── (auth)/               # login, signup, reset
│   ├── (client)/             # Brand-facing app — layout with brand switcher
│   │   ├── dashboard/
│   │   ├── deliverables/
│   │   ├── sales/
│   │   ├── plan/
│   │   └── billing/
│   ├── (contractor)/         # Contractor portal
│   │   ├── tasks/
│   │   ├── clients/
│   │   └── earnings/
│   ├── (admin)/              # Asaulia admin console
│   │   ├── brands/
│   │   ├── contractors/
│   │   ├── finances/
│   │   └── integrations/
│   ├── api/                  # REST endpoints + webhooks
│   │   ├── webhooks/stripe/
│   │   ├── webhooks/shopify/
│   │   └── cron/
│   └── layout.tsx
├── components/
│   ├── ui/                   # shadcn primitives (generated)
│   ├── kanban/
│   ├── pricing-slider/
│   ├── charts/
│   └── forms/
├── lib/
│   ├── db/                   # Drizzle schema, migrations, queries
│   │   ├── schema/           # One file per table group
│   │   ├── migrations/       # Auto-generated
│   │   └── index.ts          # Client export
│   ├── auth/                 # Supabase clients, RBAC helpers
│   ├── pricing/              # Pricing engine (see Phase 04)
│   ├── billing/              # Stripe wrappers
│   ├── integrations/         # Sales integration adapters
│   │   ├── shopify/
│   │   ├── woocommerce/
│   │   ├── stripe-sales/
│   │   └── manual/
│   ├── notifications/        # Email + in-app
│   └── utils/
├── tests/
│   ├── unit/
│   └── integration/
├── scripts/                  # seed, maintenance
├── drizzle.config.ts
├── middleware.ts             # Auth + RBAC gate
└── ...
```

## Conventions

### Naming
- Files: `kebab-case.ts`. React components: `PascalCase.tsx`.
- Table names: `snake_case_plural` (e.g. `sales_records`).
- Column names: `snake_case`.
- Types: `PascalCase`. Zod schemas: suffix with `Schema` (e.g. `PlanSchema`).
- Env vars: `SCREAMING_SNAKE_CASE`.

### Money
- Stored in cents, as `integer` (for amounts ≤ $20M) or `bigint`.
- Percentages in basis points (bps). `2000 bps = 20%`.
- Currency column always present (`currency char(3)`), even though v1 is USD-only.
- Formatting with `Intl.NumberFormat` at the UI boundary only.

### Time
- All DB `timestamptz` columns stored in UTC.
- All business logic operates in UTC.
- UI converts to user timezone for display.
- Billing cycles: defined in the brand's timezone (stored on `brands.timezone`).

### IDs
- UUID v7 (time-ordered) for all primary keys. Generate with `uuid` package or Postgres `gen_random_uuid()` (v4) if v7 extension unavailable — v4 is acceptable fallback.

### Error handling
- API routes return `{ error: { code, message } }` with appropriate HTTP status.
- Never leak internal errors to clients. Log to Sentry, return generic.
- Use `Result<T, E>` pattern for service functions (don't throw for expected failures).

### Permissions
- Central `authorize()` helper in `lib/auth/rbac.ts`. Every server action and API route calls it first.
- RLS policies as defense in depth on every tenant table.
- Never bypass RLS by using the service-role key in client-facing code paths.

### Tests
- Unit tests with Vitest. Integration tests with Playwright for critical flows only.
- Test file lives next to source: `pricing.ts` + `pricing.test.ts`.
- A phase is not done if it introduces uncovered branches in `lib/pricing`, `lib/billing`, or `lib/auth`.

### Commits & branches
- Trunk-based. Short-lived feature branches. Squash merge.
- Conventional commits: `feat(phase-04): add pricing interpolation`.
- Every PR runs CI. Green or no merge.

## Environment variables (create in Phase 01, extend per phase)

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Database direct (for Drizzle)
DATABASE_URL=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_CONNECT_CLIENT_ID=

# Resend
RESEND_API_KEY=

# Sentry
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=

# PostHog
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development

# Integrations
SHOPIFY_APP_API_KEY=
SHOPIFY_APP_API_SECRET=
SHOPIFY_APP_SCOPES=read_orders,read_products

# Cron secret (for Vercel cron auth)
CRON_SECRET=
```

## Deployment topology

- **Production:** Vercel (web) + Supabase Cloud (Postgres + Auth + Storage).
- **Preview:** Vercel preview per PR, shared Supabase `staging` project.
- **Local:** `supabase start` via CLI for a fully local stack.

## Security baseline

- RLS enabled on every tenant table (`brands`, `deliverables`, `sales_records`, `invoices`, `payouts`, etc).
- Service role key never exposed to the browser.
- Stripe webhooks verified via signature.
- Shopify webhooks verified via HMAC.
- All forms CSRF-protected via Next.js server actions.
- Rate limiting on auth routes via Vercel's edge middleware or Upstash.
- No PII in logs. No card data ever touches our servers (Stripe Elements only).
