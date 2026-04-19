# Phase 02 — Database Schema

## Objective
Define every table the app needs, create Drizzle schema files, generate and apply migrations, and seed enough data for local development.

## Depends on
Phase 01 (foundation).

## Unlocks
Phases 03, 04, 06, 07.

---

## Tasks

### 1. Organize the schema files

Create these files under `lib/db/schema/`. Each file exports its tables and relations. Then `lib/db/schema/index.ts` re-exports everything.

```
lib/db/schema/
├── users.ts
├── brands.ts
├── plans.ts
├── contractors.ts
├── deliverables.ts
├── integrations.ts
├── sales.ts
├── billing.ts
├── notifications.ts
├── audit.ts
└── index.ts
```

Delete the `_placeholder.ts` from Phase 01.

---

### 2. Schema definitions

Use Drizzle's `pgTable`. All IDs are `uuid` with `defaultRandom()`. All timestamps are `timestamp('...', { withTimezone: true }).defaultNow()`. Money is `integer` (cents) or `bigint` for very large sums. Percentages in basis points (`integer`).

#### 2.1 `users.ts`

`users` mirrors Supabase's `auth.users` via an FK. Profile data lives here.

Columns:
- `id` (uuid, PK, references `auth.users.id` on delete cascade)
- `email` (text, not null, unique)
- `full_name` (text)
- `avatar_url` (text)
- `global_role` enum: `'admin' | 'operator' | 'contractor' | 'client'`
- `timezone` (text, default `'UTC'`)
- `locale` (text, default `'en'`)
- `created_at`, `updated_at`

The `global_role` is the user's default role. A user can also have brand-scoped roles via `brand_members`.

#### 2.2 `brands.ts`

`brands` — the tenant.

Columns:
- `id` (uuid, PK)
- `slug` (text, unique, not null) — URL-friendly name.
- `name` (text, not null)
- `logo_url` (text)
- `website` (text)
- `owner_user_id` (uuid, FK → `users.id`)
- `status` enum: `'trial' | 'active' | 'past_due' | 'paused' | 'cancelled'`
- `stripe_customer_id` (text)
- `stripe_subscription_id` (text)
- `timezone` (text, default `'UTC'`)
- `billing_cycle_day` (integer, 1–28) — the day-of-month on which invoices run. Set on first payment.
- `created_at`, `updated_at`, `cancelled_at`

`brand_members` — users with access to a brand.

Columns:
- `id` (uuid, PK)
- `brand_id` (uuid, FK, on delete cascade)
- `user_id` (uuid, FK)
- `role` enum: `'owner' | 'member'`
- `invited_at`, `accepted_at`
- Composite unique: (`brand_id`, `user_id`)

#### 2.3 `plans.ts`

Append-only history of pricing changes per brand.

Columns:
- `id` (uuid, PK)
- `brand_id` (uuid, FK)
- `fixed_amount_cents` (integer, not null, check 9900 ≤ value ≤ 100000)
- `variable_percent_bps` (integer, not null, check 700 ≤ value ≤ 2000)
- `effective_from` (timestamptz, not null)
- `effective_to` (timestamptz) — NULL means current.
- `created_by_user_id` (uuid, FK)
- `reason` (text) — optional: why it changed.
- `created_at`

Index on (`brand_id`, `effective_from desc`).

Use Drizzle's `check` constraints on `fixed_amount_cents` and `variable_percent_bps`. The precise interpolation relationship is enforced in the pricing engine (Phase 04); the DB only enforces bounds.

#### 2.4 `contractors.ts`

`contractor_profiles` — one row per user with `global_role = 'contractor'`.

Columns:
- `user_id` (uuid, PK, FK → `users.id`)
- `headline` (text) — short bio.
- `skills` (text[]) — array of skill tags.
- `hourly_rate_cents` (integer) — informational only; does not affect pricing.
- `stripe_connect_account_id` (text) — for payouts.
- `payout_onboarding_complete` (boolean, default false)
- `status` enum: `'pending' | 'active' | 'paused'`
- `created_at`, `updated_at`

`brand_contractors` — assignment table.

Columns:
- `id` (uuid, PK)
- `brand_id` (uuid, FK)
- `contractor_user_id` (uuid, FK → `users.id`)
- `role` (text) — free-form label like "Ads", "Content", "SEO".
- `started_at`, `ended_at`
- Unique on (`brand_id`, `contractor_user_id`, `role`).

#### 2.5 `deliverables.ts`

Columns:
- `id` (uuid, PK)
- `brand_id` (uuid, FK)
- `period_start` (date, not null) — which billing period this belongs to.
- `period_end` (date, not null)
- `title` (text, not null)
- `description` (text)
- `type` enum: `'content_post' | 'ad_creative' | 'landing_page' | 'seo_article' | 'email_sequence' | 'strategy_doc' | 'custom'`
- `status` enum: `'todo' | 'in_progress' | 'in_review' | 'done' | 'rejected'`
- `assignee_user_id` (uuid, FK → `users.id`)
- `due_date` (date)
- `fixed_share_bps` (integer, default 0) — this deliverable's share of the fixed fee in the period. Sums to 10000 across all deliverables in the period for a brand.
- `completed_at` (timestamptz)
- `created_by_user_id` (uuid, FK)
- `created_at`, `updated_at`

Index on (`brand_id`, `period_start`, `status`).

`deliverable_attachments`:
- `id` (uuid, PK), `deliverable_id` (FK), `file_path` (text), `file_name` (text), `mime_type` (text), `size_bytes` (bigint), `uploaded_by_user_id` (uuid, FK), `uploaded_at`.

`deliverable_comments`:
- `id` (uuid, PK), `deliverable_id` (FK), `user_id` (FK), `content` (text), `created_at`.

`deliverable_activity`:
- `id`, `deliverable_id`, `actor_user_id`, `action` (text: `created | status_changed | assigned | commented | attachment_added`), `payload` (jsonb), `created_at`.

#### 2.6 `integrations.ts`

`sales_integrations`:
- `id` (uuid, PK)
- `brand_id` (uuid, FK)
- `provider` enum: `'shopify' | 'woocommerce' | 'stripe' | 'manual'`
- `status` enum: `'connecting' | 'active' | 'error' | 'disabled'`
- `display_name` (text) — e.g. "mystore.myshopify.com".
- `external_account_id` (text) — provider's account identifier.
- `config_encrypted` (bytea) — encrypted credentials. Decryption happens server-side only.
- `attribution_rules` (jsonb) — array of rules like `{ type: 'utm_source', value: 'asaulia' }`, `{ type: 'coupon', value: 'ASAULIA20' }`, `{ type: 'all', value: true }`.
- `last_synced_at` (timestamptz)
- `last_error` (text)
- `created_at`, `updated_at`

#### 2.7 `sales.ts`

`sales_records` — every sale pulled from any integration.

Columns:
- `id` (uuid, PK)
- `brand_id` (uuid, FK)
- `integration_id` (uuid, FK)
- `external_id` (text, not null) — provider's order/charge ID.
- `amount_cents` (integer, not null)
- `currency` (char(3), not null, default 'USD')
- `occurred_at` (timestamptz, not null)
- `attributed` (boolean, default false) — set by the attribution engine.
- `attribution_reason` (text) — which rule matched, for auditability.
- `raw_payload` (jsonb) — the provider's original data.
- `created_at`
- Unique on (`integration_id`, `external_id`).

Index on (`brand_id`, `occurred_at`).
Index on (`brand_id`, `attributed`, `occurred_at`) for billing aggregation.

#### 2.8 `billing.ts`

`invoices`:
- `id` (uuid, PK)
- `brand_id` (uuid, FK)
- `period_start` (date, not null)
- `period_end` (date, not null)
- `fixed_amount_cents` (integer, not null)
- `variable_amount_cents` (integer, not null)
- `total_amount_cents` (integer, not null, generated column: `fixed_amount_cents + variable_amount_cents`)
- `currency` (char(3), default 'USD')
- `status` enum: `'draft' | 'open' | 'paid' | 'failed' | 'void'`
- `stripe_invoice_id` (text)
- `issued_at` (timestamptz)
- `paid_at` (timestamptz)
- `plan_snapshot` (jsonb) — `{ fixed_cents, variable_bps }` at time of issue, for audit.
- `attributed_sales_cents` (bigint) — basis of the variable calc.
- `created_at`, `updated_at`

Unique on (`brand_id`, `period_start`).

`payouts`:
- `id` (uuid, PK)
- `contractor_user_id` (uuid, FK)
- `period_start` (date), `period_end` (date)
- `amount_cents` (integer, not null)
- `currency` (char(3), default 'USD')
- `status` enum: `'pending' | 'processing' | 'paid' | 'failed'`
- `stripe_transfer_id` (text)
- `breakdown` (jsonb) — array of `{ brand_id, fixed_share_cents, variable_share_cents, deliverables: [ids] }`.
- `paid_at` (timestamptz)
- `created_at`, `updated_at`

Unique on (`contractor_user_id`, `period_start`).

#### 2.9 `notifications.ts`

- `id` (uuid, PK)
- `user_id` (uuid, FK)
- `type` (text) — `deliverable_assigned`, `invoice_issued`, `payout_paid`, etc.
- `title` (text, not null)
- `body` (text)
- `link_url` (text)
- `read_at` (timestamptz)
- `created_at`

#### 2.10 `audit.ts`

`audit_log` — for sensitive actions (plan changes, manual sales entry, payout overrides).

- `id` (uuid, PK)
- `actor_user_id` (uuid, FK)
- `brand_id` (uuid, FK, nullable)
- `action` (text, not null)
- `entity_type` (text)
- `entity_id` (uuid)
- `before` (jsonb), `after` (jsonb)
- `ip_address` (inet)
- `user_agent` (text)
- `created_at`

---

### 3. Relations

In each schema file, define Drizzle `relations(...)` so queries can use the query-builder's `.with({ ... })` syntax.

Key relations:
- `brands` → many `brand_members`, many `plans`, many `deliverables`, many `sales_integrations`, many `sales_records`, many `invoices`.
- `users` → one `contractor_profile`, many `brand_members`, many `deliverables` (as assignee), many `notifications`.
- `deliverables` → many `deliverable_attachments`, many `deliverable_comments`, many `deliverable_activity`.

---

### 4. Enums

Create Drizzle enum definitions in a shared `lib/db/schema/enums.ts` to avoid duplication:

```ts
import { pgEnum } from 'drizzle-orm/pg-core';

export const globalRoleEnum = pgEnum('global_role', ['admin', 'operator', 'contractor', 'client']);
export const brandStatusEnum = pgEnum('brand_status', ['trial', 'active', 'past_due', 'paused', 'cancelled']);
export const brandMemberRoleEnum = pgEnum('brand_member_role', ['owner', 'member']);
export const contractorStatusEnum = pgEnum('contractor_status', ['pending', 'active', 'paused']);
export const deliverableTypeEnum = pgEnum('deliverable_type', [
  'content_post', 'ad_creative', 'landing_page', 'seo_article', 'email_sequence', 'strategy_doc', 'custom',
]);
export const deliverableStatusEnum = pgEnum('deliverable_status', [
  'todo', 'in_progress', 'in_review', 'done', 'rejected',
]);
export const integrationProviderEnum = pgEnum('integration_provider', ['shopify', 'woocommerce', 'stripe', 'manual']);
export const integrationStatusEnum = pgEnum('integration_status', ['connecting', 'active', 'error', 'disabled']);
export const invoiceStatusEnum = pgEnum('invoice_status', ['draft', 'open', 'paid', 'failed', 'void']);
export const payoutStatusEnum = pgEnum('payout_status', ['pending', 'processing', 'paid', 'failed']);
```

---

### 5. Migrations

- [x] `pnpm db:generate` — produces SQL in `lib/db/migrations/`.
- [x] Inspect the generated SQL. Pay attention to:
  - Enum types are created before tables that use them.
  - FKs with `on delete cascade` where the parent "owns" the child (e.g. brand → deliverables).
  - FKs with `on delete set null` where the child should survive (e.g. deliverable assignee).
- [x] `pnpm db:push` — apply to local Supabase.
- [x] Commit the migrations.

---

### 6. Row Level Security (RLS)

Create `lib/db/rls.sql` with policies. Apply via a migration or a Supabase CLI migration.

Enable RLS on every tenant table. Baseline policies:

- `brands`: user can select if they are a member (exists in `brand_members`) OR global role is admin/operator.
- `brand_members`: user can select their own rows; admin sees all.
- `deliverables`: user can select if they are a member of the brand OR the assignee OR admin.
- `plans`: member of brand OR admin.
- `sales_integrations`, `sales_records`, `invoices`: member of brand OR admin.
- `contractor_profiles`: self OR admin OR (operator). Brands cannot see contractor payout info.
- `brand_contractors`: brand members see their own brand's rows; contractors see rows where they are the contractor; admin sees all.
- `payouts`: self OR admin.

Write policies to check against `auth.uid()` and a helper function `is_brand_member(brand_id uuid)` defined as a Postgres function.

Do NOT rely on RLS alone for writes — all writes go through server actions / API routes that also call `authorize()` (from Phase 03). RLS is the second line of defense.

---

### 7. Seed script

Create `scripts/seed.ts` that creates:
- 1 admin user (`admin@asaulia.test`)
- 2 contractor users (`ana@asaulia.test`, `bruno@asaulia.test`) with contractor profiles.
- 2 client owner users (`founder1@brandone.test`, `founder2@brandtwo.test`).
- 2 brands ("Brand One" and "Brand Two").
- Plans: Brand One on $99+20%, Brand Two on $500 + interpolated %.
- Brand contractors assignments.
- 5 deliverables each, mixed statuses.
- 20 sample sales records per brand (some attributed, some not).

Seed uses service role key. Idempotent — wipe and re-seed is fine.

Add `"db:seed": "tsx scripts/seed.ts"` to scripts. `pnpm add -D tsx`.

---

### 8. Types

- [x] In `lib/db/index.ts`, export `InferSelectModel` and `InferInsertModel` typed aliases:
  ```ts
  import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
  import { brands } from './schema/brands';
  export type Brand = InferSelectModel<typeof brands>;
  export type NewBrand = InferInsertModel<typeof brands>;
  ```
  Do this for every table. Keep them in `lib/db/types.ts` to avoid clutter.

---

## Acceptance criteria

- `pnpm db:generate` produces a clean migration with no warnings.
- `pnpm db:push` applies without errors.
- `pnpm db:seed` populates the tables listed above.
- `pnpm db:studio` opens and shows the data.
- RLS policies compile and are active (run `SELECT relrowsecurity FROM pg_class WHERE relname = 'brands';` — should be `t`).
- `pnpm typecheck` passes with full type inference on queries.
- Check constraints on `plans.fixed_amount_cents` and `plans.variable_percent_bps` verified by attempting to insert out-of-range values (should error).

---

## Tests (add in `tests/unit/db.test.ts`)

- Given a seeded local DB, selecting from `brands` with `with: { plans: true }` returns both brands, each with their plan history.
- Inserting a plan with `fixed_amount_cents = 5000` (below $99) fails with a check constraint error.
- Inserting into `sales_records` with duplicate `(integration_id, external_id)` fails with unique constraint.

---

## Notes & gotchas

- Drizzle does not auto-manage enum renames — if you rename an enum value later, write a manual migration.
- Use `timestamp('col', { withTimezone: true, mode: 'date' })` so Drizzle returns JS `Date` objects directly.
- For money columns, prefer `integer` over `numeric` — faster and simpler for cents.
- The `total_amount_cents` generated column syntax differs slightly by Postgres version. Use: `.generatedAlwaysAs(sql`... stored`)`. Verify it produces `GENERATED ALWAYS AS (...) STORED`.
- Never store raw integration credentials. Encrypt with a symmetric key from env before inserting. Phase 07 adds the encryption helper.

---

## Next phase

`03-auth.md` — wire Supabase Auth, signup/login, invitations, RBAC.
