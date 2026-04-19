# Phase 07 — Sales Attribution & Integrations

## Objective
Build the integrations framework and the first four adapters: Shopify, WooCommerce, Stripe, and Manual. Every sale that lands in the system is normalized into a `sales_records` row and classified as attributed or not by a rules engine. The brand only pays variable on attributed sales.

## Depends on
Phase 02 (database). Runs in parallel with Phase 06.

## Unlocks
Phase 08 (client sales dashboard), Phase 11 (billing needs attributed sales).

---

## Design

### Adapter contract

Every integration implements the same interface:

```ts
// lib/integrations/types.ts
export type NormalizedSale = {
  externalId: string;
  amountCents: number;
  currency: string;
  occurredAt: Date;
  metadata: Record<string, unknown>; // UTMs, coupon codes, customer email hash, channel, etc.
};

export interface SalesAdapter {
  provider: 'shopify' | 'woocommerce' | 'stripe' | 'manual';

  /** Initial OAuth or credential dance. Returns config to be encrypted and stored. */
  connect(input: { brandId: string; payload: unknown }): Promise<{
    externalAccountId: string;
    displayName: string;
    config: unknown;
  }>;

  /** Fetch sales since a cursor. Called by the sync job. */
  pullSince(ctx: { config: unknown; since: Date }): Promise<NormalizedSale[]>;

  /** For webhook-capable providers: parse incoming webhook and return sales. */
  handleWebhook?(ctx: { config: unknown; headers: Headers; body: string }): Promise<NormalizedSale[]>;

  /** Disconnect / revoke. */
  disconnect(ctx: { config: unknown }): Promise<void>;
}
```

### Attribution rules engine

Stored per-integration in `sales_integrations.attribution_rules` (jsonb). A list of rules; a sale is attributed if ANY rule matches.

```ts
type AttributionRule =
  | { type: 'all' }                              // All sales from this integration are attributed.
  | { type: 'utm_source'; values: string[] }     // metadata.utm_source ∈ values
  | { type: 'utm_medium'; values: string[] }     // metadata.utm_medium ∈ values
  | { type: 'utm_campaign_prefix'; prefix: string }
  | { type: 'coupon'; codes: string[] }          // metadata.coupon ∈ codes
  | { type: 'landing_page_prefix'; prefix: string }; // metadata.landing ∈ prefix
```

Function `classify(sale: NormalizedSale, rules: AttributionRule[])` returns `{ attributed: boolean; reason: string | null }`. Reason is the first matching rule's ID for audit.

Default for a new integration: `[{ type: 'all' }]` when the brand explicitly says "Asaulia manages everything here", otherwise `[]` (nothing attributed; admin must configure rules).

### Credential encryption

File `lib/integrations/crypto.ts`:

```ts
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const KEY = Buffer.from(env.INTEGRATIONS_ENCRYPTION_KEY, 'base64'); // 32 bytes

export function encryptConfig(obj: unknown): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', KEY, iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(obj), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, data]);
}

export function decryptConfig<T>(buf: Buffer): T {
  const iv = buf.subarray(0, 12);
  const authTag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(authTag);
  const plain = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(plain.toString('utf8'));
}
```

Add `INTEGRATIONS_ENCRYPTION_KEY` to env. Generate via `openssl rand -base64 32`.

---

## Tasks

### 1. Framework

- [ ] `lib/integrations/registry.ts` — map provider name to adapter instance.
- [ ] `lib/integrations/classify.ts` — attribution rules engine + tests.
- [ ] `lib/integrations/crypto.ts` — as above.
- [ ] `lib/integrations/service.ts`:
  - `connectIntegration({ brandId, provider, payload })` — calls adapter's `connect`, encrypts config, inserts `sales_integrations` row.
  - `ingestSales({ integrationId, sales })` — upsert into `sales_records` with `ON CONFLICT (integration_id, external_id) DO NOTHING`, running `classify` for each.
  - `syncIntegration({ integrationId })` — load integration, decrypt config, call `pullSince`, ingest results, update `last_synced_at`.

### 2. Shopify adapter

- [ ] `lib/integrations/shopify/index.ts`.
- [ ] Register a Shopify Custom App in the admin account (document steps in `docs/integrations/shopify.md`).
- [ ] OAuth flow:
  - Route: `app/api/integrations/shopify/install/route.ts` — redirects to Shopify OAuth grant.
  - Route: `app/api/integrations/shopify/callback/route.ts` — exchanges code for access token, saves via `connectIntegration`.
- [ ] `pullSince`: call the Shopify Admin API `/orders.json?status=any&created_at_min=...&limit=250&fields=id,created_at,total_price,currency,note_attributes,discount_codes,landing_site,referring_site,source_name`. Paginate with `Link: rel="next"` header.
- [ ] Map to `NormalizedSale`:
  - `externalId = order.id`
  - `amountCents = Math.round(Number(order.total_price) * 100)`
  - `currency = order.currency`
  - `occurredAt = new Date(order.created_at)`
  - `metadata = { utm_source, utm_medium, utm_campaign, coupon: discount_codes?.[0]?.code, landing: order.landing_site, source: order.source_name }` — extract UTMs from `note_attributes` or `landing_site` query string.
- [ ] `handleWebhook`: subscribe to `orders/create` and `orders/updated`. Verify with HMAC per Shopify docs. Map to sales, ingest.
- [ ] `disconnect`: revoke the access token via Shopify API.

Env vars: `SHOPIFY_APP_API_KEY`, `SHOPIFY_APP_API_SECRET`, `SHOPIFY_APP_SCOPES=read_orders,read_products`.

### 3. WooCommerce adapter

Simpler: read-only REST API key.

- [ ] Setup flow: user enters the store URL, Consumer Key, Consumer Secret.
- [ ] `pullSince`: `GET /wp-json/wc/v3/orders?after=ISO8601&per_page=100`. Paginate.
- [ ] Map to `NormalizedSale` similarly (extract UTMs from `meta_data`, coupon from `coupon_lines[0].code`).
- [ ] No webhook for v1 (pull-only). Scheduled sync every 15 minutes.

### 4. Stripe adapter

For brands whose entire checkout is a Stripe Payment Link or a custom Stripe integration (no Shopify/WooCommerce).

- [ ] Setup flow: Stripe Connect (Standard) OAuth. Save `stripe_account_id` as `externalAccountId`.
- [ ] `pullSince`: `stripe.charges.list({ created: { gte: ... }, limit: 100 })`, paginate with `starting_after`. Filter out refunded unless we want to bill on gross (recommend net — only count `status === 'succeeded'` and subtract any refunds by storing a `refunded_amount_cents` side field).
- [ ] Map to `NormalizedSale`:
  - `externalId = charge.id`
  - `amountCents = charge.amount - (charge.amount_refunded || 0)`
  - `metadata` from `charge.metadata` (brand is expected to pass UTMs as metadata at checkout).
- [ ] Webhook: subscribe to `charge.succeeded`, `charge.refunded`, `checkout.session.completed`. Single endpoint shared with our own billing Stripe webhook (Phase 11), dispatched by event type.

Use a **separate Stripe account / API key** for the Stripe-as-sales-source integration vs Asaulia's own billing Stripe. Prevent confusion.

### 5. Manual adapter

For brands without a supported integration, or for one-off corrections.

- [ ] UI under admin console `app/(admin)/brands/[brandId]/sales/manual/page.tsx`:
  - Form: amount, currency, occurredAt, source/description, attribution reason.
  - Upload a proof attachment (invoice screenshot, etc.) to `manual-sales-proofs` bucket.
- [ ] Server action `addManualSale`:
  - Creates a sales_record with `integration.provider = 'manual'`.
  - Auto-marks `attributed = true` and stores the reason provided by the admin.
  - Writes an entry to `audit_log`.

Manual sales require admin role; client owners cannot add them.

### 6. Sync scheduling

- [ ] Create `app/api/cron/sync-integrations/route.ts`:
  - Protected by `CRON_SECRET` header.
  - Iterates all `status='active'` integrations, runs `syncIntegration` with a 30s budget per integration.
  - Logs start/end, updates `last_synced_at`, records errors to `last_error`.
- [ ] Add a Vercel cron in `vercel.json`:
  ```json
  { "crons": [{ "path": "/api/cron/sync-integrations", "schedule": "*/15 * * * *" }] }
  ```

### 7. Integrations UI

- [ ] `app/(admin)/brands/[brandId]/integrations/page.tsx` — list with status indicators, last sync time, error state.
- [ ] `app/(admin)/brands/[brandId]/integrations/new/page.tsx` — picker of providers.
- [ ] Per-provider connect wizard (Shopify / WooCommerce / Stripe / Manual).
- [ ] Attribution rules editor: a form that lets admin add/remove rules. Save calls `updateIntegrationRules`.

Clients do NOT configure integrations in v1 — Asaulia operators set them up during onboarding. Clients only see their data.

### 8. Reclassification

When attribution rules change, retroactively re-evaluate historic sales.

- [ ] Server action `reclassifyIntegration({ integrationId })`:
  - Loads all sales_records for the integration.
  - For each, runs `classify` with the new rules.
  - Updates `attributed` and `attribution_reason` in bulk.
  - Writes an audit entry summarizing the delta.
- [ ] UI: after editing rules, show a confirmation dialog with a preview "Will mark 23 sales as attributed, 5 as not attributed". On confirm, run.
- [ ] Important: reclassification of sales in a **closed billing period** does NOT alter past invoices. Only the open period is affected. Implement by only reclassifying sales where `occurred_at >= current_period_start`.

### 9. Sales aggregation

A reusable query for Phase 08 and Phase 11:

```ts
// lib/integrations/aggregate.ts
export async function attributedSalesForPeriod(
  brandId: string,
  period: { start: Date; end: Date }
): Promise<{ totalCents: number; count: number }> {
  // SUM(amount_cents), COUNT(*) WHERE brand_id = ? AND attributed = true AND occurred_at BETWEEN ...
}
```

Index on `(brand_id, attributed, occurred_at)` — should already exist from Phase 02.

---

## Acceptance criteria

- Admin can connect a Shopify store via OAuth in local dev (using Shopify's dev store).
- Orders placed in that Shopify dev store appear in `sales_records` within 2 minutes (via webhook) AND via the 15-minute pull as a backup.
- Manual sales entry works and is audit-logged.
- Changing attribution rules updates the flag on sales in the current period; closed periods remain untouched.
- The attributed-sales total for a brand for the current period matches the sum you can compute from the DB manually.
- The `last_error` field populates when an integration fails a sync; UI shows the error; a retry button re-runs the sync.
- Dropping a malformed Shopify webhook does not crash the handler; it returns 400 with a clear log entry.

---

## Tests

Unit:
- `classify()` against every rule type, including rules combined (any-match).
- `encryptConfig` / `decryptConfig` round-trip.
- Shopify order → `NormalizedSale` mapping for 5 fixture orders covering different UTM placements and coupon shapes.

Integration (mocked external APIs via `msw`):
- Shopify `pullSince` paginates through 3 pages.
- Webhook handler rejects invalid HMAC.

---

## Notes & gotchas

- **Shopify session tokens vs access tokens:** we want an offline access token (long-lived) since we poll server-side. Request it via the standard OAuth `redirect_uri` flow; do not use session tokens.
- **Rate limits:**
  - Shopify Admin REST: 2 req/s/store (burst 40). Implement a tiny leaky-bucket per-store.
  - Stripe: default 100 read req/s (very generous). No throttling needed.
- **Timezones:** providers report times in UTC but timestamps sometimes come back as strings without a Z. Always parse and then `.toISOString()`.
- **Multi-store per brand:** supported. A single brand can connect to Shopify AND WooCommerce AND manual — every integration is a separate row. Aggregation sums across.
- **De-dupe:** the `(integration_id, external_id)` unique index prevents double-inserts from webhook + pull overlap.
- **PII:** do NOT store customer emails in `sales_records.raw_payload`. Strip emails and names server-side before persistence (hash if you need uniqueness).

---

## Next phase

`08-client-dashboard.md` — put integrations + deliverables + pricing together into the client-facing app.
