# Performance & QA plan — 12 phases

_Last audit: 2026-04-19 · scope: `main` after PR #21._

Three parallel static audits (QA, backend, frontend) fed into the roadmap
below. Phases are ordered by **ROI (impact / effort)** — start at phase 1
and ship them in order. Each phase is small enough to land in its own PR.

> **Baseline assumption.** We don't have live RUM. "Expected win" numbers
> are rough estimates from first-principles (query planner behaviour,
> hydration cost, typical connection-pool latency of ~50 ms/query).
> Phase 12 wires up real measurement so future phases can be justified
> with numbers instead of guesses.

## Phase 0 — QA findings to land alongside the perf work

Correctness gaps surfaced during the audit. Cheap to fix, so absorb them
into the first couple of PRs rather than a dedicated cycle.

| # | Where | Issue | Fix |
|---|-------|-------|-----|
| Q1 | `app/actions/admin-bonuses.ts:207` | `adminMarkBonusPaidAction` returns `info: 'resolved'`; union says `'paid'` is more accurate | switch literal, update union |
| Q2 | `app/admin/brands/page.tsx:129`, `contractors/page.tsx:132`, `finances/payouts/page.tsx:116` | Status badges render raw DB enum (`active`, `past_due`, `pending`…) — violates the i18n rule spirit even though it sneaks past the linter | map to `statuses.brand.*` / `statuses.contractor.*` / `statuses.payout.*` and add keys in both catalogs |
| Q3 | `app/admin/finances/invoices/page.tsx:85` | `displayCurrency` defaults to `USD` when filtered rows span both regions → summary shows wrong currency | force `region` filter for summary, or render two summaries side-by-side |
| Q4 | `app/actions/admin-brand-contractors.ts` | `role` is free-form `z.string()` — typos create distinct unique keys forever | lift to `z.enum([...known roles])` plus a `custom` escape hatch |
| Q5 | `lib/billing/close.ts:75` | Latest-plan lookup uses `lt(effectiveFrom, cycle.end)` — a plan created **during** the cycle is ignored. Verify matches product intent; either OK or switch to `lte(effectiveFrom, cycle.end)` | product decision, then align |

---

## Phase 1 — Composite indexes on hot billing tables

**Objetivo.** Kill the sequential scans visible in the admin finance dashboards. These pages hit `invoices` / `payouts` / `contractor_bonuses` with combined `(status, finance_region, paid_at|resolved_at)` filters that today fall back to the unique index on `(brand_id, period_start)`.

**Archivos.**
- New migration `lib/db/migrations/0009_performance_indexes.sql`
- Mirror on schema: `lib/db/schema/billing.ts`, `contractors.ts`, `bonuses.ts`, `audit.ts`

**Tareas.**
1. `CREATE INDEX CONCURRENTLY` for:
   - `invoices (finance_region, status, paid_at DESC)`
   - `invoices (brand_id, period_end DESC)` — covers the past-due + per-brand views
   - `payouts (finance_region, status, paid_at DESC)`
   - `payouts (contractor_user_id, period_end DESC)`
   - `contractor_bonuses (contractor_user_id, status, resolved_at DESC)`
   - `brand_contractors (contractor_user_id) WHERE ended_at IS NULL` — partial
   - `deliverables (assignee_user_id, status, archived_at) WHERE archived_at IS NULL` — partial
   - `audit_log (actor_user_id, created_at DESC)`
   - `ledger_entries (finance_region, created_at DESC)`
2. Add matching `.index(...)` declarations to the Drizzle schema so `db:push` keeps them.
3. Run `EXPLAIN (ANALYZE, BUFFERS)` on: `/admin/finances`, `/admin/finances/invoices?region=co`, `/admin/contractors/matrix`, `/admin/finances/payouts`, `/admin/finances/close`. Capture before/after in the PR.

**Impacto esperado.** Admin dashboards 800 ms → 500 ms (−35 %) on a warm DB with real data. Close-period queries drop from 4 full scans to 4 index scans.

**Verificación.** `pnpm db:push` applies. `EXPLAIN` shows `Index Scan` for every query touched.

---

## Phase 2 — Paralelizar queries sequenciales

**Objetivo.** Every serial `await db.*` sequence inside a server component burns one round-trip. Collapse independent ones into `Promise.all`.

**Archivos.**
- `app/admin/contractors/[userId]/page.tsx` — 5 sequential `await db.select(...)` calls (user, profile, assignments, payouts, deliverables, bonuses)
- `app/actions/admin-finances.ts:373-413` — `computeFinancePeriodTotals` runs revenue + payouts + bonuses serially
- `app/admin/finances/close/page.tsx` — already parallel at the top, but the inner `liveTotals` loop fires three serial queries per month

**Tareas.**
1. Collapse the `[userId]` page into one `Promise.all`.
2. Inside `computeFinancePeriodTotals`, run the three aggregates with `Promise.all`.
3. In the close page, reshape `computeFinancePeriodTotals` to accept a list of (region, year, month) tuples and compute all in one query (GROUP BY) — see Phase 9.

**Impacto esperado.** −3 round-trips × ~50 ms = −150 ms per affected page.

---

## Phase 3 — Streaming via Suspense + `loading.tsx`

**Objetivo.** Today no route uses `<Suspense>` or a `loading.tsx`. Slow queries block the entire server render. Ship progressively.

**Archivos.**
- `app/admin/finances/close/page.tsx` — the heaviest offender; 24 months × 2 regions of live totals blocks first paint
- `app/admin/page.tsx` — KPI + recent audit events; show KPIs immediately, stream events
- `app/admin/contractors/matrix/page.tsx` — 3 heavy queries

**Tareas.**
1. Extract the `liveTotals` section of `finances/close` into an async `<LivePeriods>` server component, wrap in `<Suspense fallback={<PeriodsSkeleton/>}>`.
2. Add `app/admin/loading.tsx` + `app/admin/finances/loading.tsx` + `app/admin/finances/close/loading.tsx` with consistent skeletons.
3. Split `admin/page.tsx` into two async children so KPI cards render before the audit feed.

**Impacto esperado.** TTFB unchanged; FCP on admin dashboards drops 500–2 000 ms once streamed.

---

## Phase 4 — `next.config.ts` wins

**Objetivo.** Landing micro-optimisations that cost nothing but reduce bundle + bytes shipped.

**Archivos.** `next.config.ts`

**Tareas.**
```ts
export default {
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },
};
```
(keep existing turbopack config)

**Impacto esperado.** −8 to −12 KB gzipped from icon tree-shaking; AVIF saves ~30 % on the marketing logo.

---

## Phase 5 — Quitar `'use client'` donde no hace falta

**Objetivo.** Three form wrappers are `'use client'` only to call `useActionState`. They don't own state beyond the action's own result — they're 100 % re-renderable on the server.

**Archivos.**
- `app/admin/brands/[brandId]/contractors/end-assignment-form.tsx`
- `app/(auth)/signup/signup-form.tsx`
- `app/(client)/chat/composer.tsx`

**Tareas.**
1. Drop `'use client'`; pass the server action directly as `action={...}` on a plain `<form>`.
2. Move the "pending / result" display into a small inline client component (`useFormStatus`) so the rest of the form stays server-rendered.

**Impacto esperado.** −4 KB hydration per form × 3 forms on hot paths.

---

## Phase 6 — Code-split heavy interactive components

**Objetivo.** The kanban + pricing-slider are loaded eagerly but only matter on specific routes.

**Archivos.**
- `components/kanban/Board.tsx` (+ `@dnd-kit/core`, `@dnd-kit/sortable`, `DeliverableSheet.tsx`)
- `components/pricing-slider/PricingSlider.tsx`

**Tareas.**
1. Replace direct imports with:
   ```ts
   const Board = dynamic(() => import('@/components/kanban/Board').then(m => m.Board), { ssr: false, loading: () => <BoardSkeleton /> });
   ```
2. Keep the kanban board SSR-able for deep-linking where possible; if `@dnd-kit` throws on SSR, confirm `ssr: false`.
3. Same treatment for `PricingSlider` inside the onboarding flow.

**Impacto esperado.** −25 KB gzipped off the `/deliverables` and onboarding bundles.

---

## Phase 7 — `revalidateTag` en lugar de `revalidatePath`

**Objetivo.** Several actions call `revalidatePath` 2–3 times, which invalidates entire route segments. Switch to tag-based invalidation so caches stay warm where they don't need to change.

**Archivos.**
- `app/actions/admin-finances.ts` — lines 118-119, 184, 302, 354
- `app/actions/admin-brand-contractors.ts` — lines 100-101, 145-146
- Data fetchers in `lib/billing/*` and page queries — wrap reads in `cache(() => ..., { tags: ['finances:co'] })` style

**Tareas.**
1. Define tag constants in a new `lib/cache/tags.ts`: `INVOICES_BY_REGION(region)`, `PAYOUTS_BY_REGION(region)`, `BRAND_CONTRACTORS(brandId)`, etc.
2. Convert hot reads to `unstable_cache(read, [key], { tags: [...] })`.
3. Replace `revalidatePath(...)` with `revalidateTag(...)` in mutating actions.

**Impacto esperado.** Admin nav feels "instant" after first visit in a session; saves repeated DB hits for invariant pages.

---

## Phase 8 — Route-level `revalidate`

**Objetivo.** A handful of pages are safe to cache for tens of seconds even without tag invalidation.

**Archivos.**
- `app/admin/finances/invoices/page.tsx` → `export const revalidate = 60`
- `app/admin/contractors/matrix/page.tsx` → `export const revalidate = 300` (only changes when assignments flip)
- `app/admin/audit/page.tsx` → `revalidate = 30`

**Tareas.** Audit for any action that mutates these datasets and make sure Phase 7's tags cover them.

**Impacto esperado.** Navigating between admin tabs costs near-zero DB after first hit.

---

## Phase 9 — Consolidar agregaciones financieras

**Objetivo.** `computeFinancePeriodTotals` is called once per (region, month) on the close page — for a 12-month window that's **72 round-trips** per render. Do it in one query.

**Archivos.** `app/actions/admin-finances.ts`, `app/admin/finances/close/page.tsx`

**Tareas.**
1. Replace the three `db.select` calls with a single `UNION ALL` or a `LEFT JOIN LATERAL (…) t` that returns `(finance_region, year, month, revenue_cents, payouts_cents, bonuses_cents)` in one shot.
2. Refactor `computeFinancePeriodTotals` to also accept the list form used by the close page.
3. Same trick for the existing `adminMarkInvoicePaidAction` flow — wrap in `db.transaction`.

**Impacto esperado.** Close page 2 000 ms → 300 ms on a 12-month dataset.

---

## Phase 10 — Dependencias y bundle hygiene

**Objetivo.** Delete dead weight.

**Archivos.** `package.json`, plus grep-verification across `app/` and `components/`.

**Tareas.**
1. Confirm `@tanstack/react-query` has **zero imports** in the repo (audit agent reported 0). If true: `pnpm remove @tanstack/react-query`.
2. Audit `posthog-js` usage — it shouldn't ship in login/signup/contractor dashboards. Lazy-init via `dynamic` or move to a deferred entry.
3. Regenerate lockfile, ensure CI still passes.

**Impacto esperado.** −20 to −90 KB gzipped from the main bundle.

---

## Phase 11 — i18n status labels + QA fixes

**Objetivo.** Close the Phase 0 list that wasn't already squashed.

**Archivos.**
- `messages/en.json`, `messages/es.json` — add `statuses.brand.*`, `statuses.contractor.*`, `statuses.payout.*`, `statuses.invoice.*`, `statuses.period.*` keys (most of these already exist; fill the gaps)
- `app/admin/brands/page.tsx`, `app/admin/contractors/page.tsx`, `app/admin/finances/payouts/page.tsx`, `app/admin/finances/invoices/page.tsx`, `app/admin/finances/close/page.tsx` — replace raw enum renders with `t(...)` lookups

**Tareas.** 1 PR per file batch; verify `pnpm i18n:check` keeps parity.

**Impacto esperado.** No perf win per se, but necessary for the product's bilingual brand. Also lets us finally move the ESLint rule from `warn` to `error`.

---

## Phase 12 — Observabilidad + presupuestos

**Objetivo.** Stop guessing. Measure every deploy so the next round of perf work is data-driven.

**Tareas.**
1. Add `@vercel/analytics` + `@vercel/speed-insights` (or self-host equivalents) — they're tiny and Server-first.
2. Wire `next/bundle-analyzer` into `pnpm analyze`.
3. Ship a simple Lighthouse CI workflow on PRs to `main` with budgets:
   - LCP ≤ 2.5 s on `/admin`, `/client`, `/contractor`
   - TBT ≤ 200 ms
   - JS payload ≤ 200 KB gzipped per route
4. Add a `scripts/perf-check.sh` that runs `pnpm build && pnpm analyze` locally.

**Impacto esperado.** Makes regressions loud; turns the remaining phases from "best guess" into "tracked delta".

---

## Phase 13 — i18n de la página Plan de marca (admin)

**Objetivo.** La pantalla `/admin/brands/[brandId]/plan` sigue 100 % en inglés (capturada por el usuario 2026-04-19). Es un agujero i18n obvio en un flujo que el equipo comercial usa a diario.

**Literales detectados.**
- Encabezado del historial: `Plan history`
- Texto `from {date} · current` y los badges `active` / `cancelled` (el `cancelled` del chip junto al nombre de marca comparte código con el resto del header)
- Sección override: `Override`, `Bypasses the client-side cooldown. Every override is audit-logged with the reason.`
- Labels de formulario: `FIXED (CENTS)`, `VARIABLE (BPS)`, `EFFECTIVE FROM (ISO)`, `REASON (≥ 8 CHARS, AUDITED)`
- Placeholder: `Escalation from support ticket #…`
- Botón: `Save override`
- Fecha `Apr 19, 2026` — renderizar con `formatDate` (ya locale-aware)

**Archivos.**
- `messages/en.json`, `messages/es.json` — nuevo namespace `admin.brandPlan.{history, from, current, override, overrideDesc, fixedCents, variableBps, effectiveFrom, reasonLabel, reasonPlaceholder, save}` + reutilizar `statuses.brand.*` para `active`/`cancelled` (Phase 11 ya abre esas keys).
- `app/admin/brands/[brandId]/plan/page.tsx` — `getTranslations('admin.brandPlan')`; cambiar badge inline por `<StatusPill>` traducido.
- `app/admin/brands/[brandId]/plan/override-form.tsx` (cliente) — `useTranslations`; mover el `reason` minLength (8) a una prop o a ICU plural en el label.

**Tareas.** 1 PR. Validar `pnpm i18n:check` + `pnpm lint` (no debe aparecer ningún warning nuevo de `i18next/no-literal-string` en esos archivos).

**Impacto esperado.** Cierra el bug visual reportado, elimina ~10 literales, acerca el ESLint rule a pasar de `warn` → `error` (Phase 11).

---

## Phase 14 — Pool de comisiones por marca con asignaciones por contratista (USD + COP)

**Objetivo.** Hoy los contratistas reciben pagos sin un techo por marca: el admin paga ad-hoc y los cierres financieros no distinguen bien COP vs USD cuando la marca tiene contratistas en ambas regiones. Se necesita un pool de comisión definido por marca (como % de revenue o monto fijo), asignable por contratista y por moneda, con enforcement al crear pagos.

**Modelo de datos.**
- `brand_commission_pools` — uno por marca:
  - `id`, `brandId` (unique), `poolBps` (bps del revenue bruto) **o** `poolAmountCents` (fijo), `currency` enum `'usd' | 'cop'`, `periodScope` enum `'monthly' | 'quarterly' | 'per_project'`, `createdAt`, `updatedAt`, `createdBy`.
  - Indexes: `(brandId)` unique, `(currency)`.
- `brand_contractor_allocations` — asigna % del pool a cada contratista activo:
  - `id`, `brandId`, `contractorUserId`, `allocationBps` (0–10 000), `currency` (`'usd' | 'cop'`, debe coincidir con el pool), `startedAt`, `endedAt` (nullable → soft-end, mismo patrón que `brand_contractors`), `createdBy`.
  - Unique parcial `(brandId, contractorUserId, currency) WHERE ended_at IS NULL`.
  - Invariante: `SUM(allocationBps) WHERE ended_at IS NULL AND brandId = $1 AND currency = $2` ≤ 10 000 (validado en server action y por un `CHECK` si Postgres lo permite, si no por trigger).
- `contractor_payouts` (ya existe) — añadir `allocationId` nullable FK + `financeRegion` (ya está). Nuevo check: el monto del payout no puede exceder `pool_available_for_contractor(brandId, contractorUserId, currency, periodKey) − sum(payouts emitidos ya en ese period)`.

**Server actions.**
- `adminSetBrandCommissionPoolAction` — crea/actualiza el pool. Audit log.
- `adminUpsertBrandContractorAllocationAction` — inserta/actualiza allocation; valida la suma ≤ 100 % antes de commit.
- `adminEndBrandContractorAllocationAction` — soft-delete.
- `adminCreateContractorPayoutAction` (refactor del existente) — antes de crear el payout:
  1. Resolver `currency` del contratista para la marca (de la allocation activa).
  2. Calcular `poolCeilingCents` para el período actual.
  3. Calcular `allocationCeilingCents = poolCeilingCents * allocationBps / 10000`.
  4. Restar payouts ya emitidos en ese período con ese `(brandId, contractorUserId, currency)`.
  5. Rechazar con error `exceeds_pool_ceiling` si el nuevo monto lo rompe.

**UI.**
- Nueva sección en `app/admin/brands/[brandId]/contractors/page.tsx` (o una ruta hermana `/plan-contractors`): tabla de allocations con `%`, `currency`, botones "Edit" y "End".
- Formulario "Set pool" con toggle bps vs monto fijo + selector `USD | COP`.
- Tabla muestra "techo disponible este período" por contratista (calculado server-side con un Promise.all similar al de Phase 2).
- Página `app/admin/finances/close/page.tsx` — el bucket por región ya existe (Project 2); añadir sub-totales por `(brand, contractor)` cuando hay allocations definidas, para que el cierre mensual muestre "comisiones comprometidas" vs "comisiones emitidas" por moneda.

**Financial close impact.**
- `computeFinancePeriodTotals` debe agrupar `contractor_payouts` por `financeRegion` y excluir cross-currency bleed: si un contratista tiene allocations en USD y COP, se contabilizan por separado y no se convierten.
- Nuevo reporte per-brand que compara `pool_ceiling − emitted` para exponer "pool no utilizado" al cierre.

**i18n.**
- Nuevo namespace `admin.commissionPool.*` y `moduleErrors.admin.commissionPool.{invalid_input, pool_not_found, allocation_not_found, currency_mismatch, exceeds_100_percent, exceeds_pool_ceiling, brand_not_found, contractor_not_found, generic}`.

**Tareas (orden sugerido, 1 PR por bullet).**
1. Schema: tablas + indexes + unique parcial. Push con `pnpm db:push`.
2. Server actions (+ zod) con tests manuales en dev.
3. UI de pool/allocations dentro del detalle de marca.
4. Enforcement en `adminCreateContractorPayoutAction`.
5. Sub-totales por brand/contratista en `finances/close`, por moneda.

**Impacto esperado.** Cierra el gap operativo actual (admin pagando sin techo); el cierre mensual refleja correctamente COP vs USD y "pool comprometido vs emitido" por marca; reduce errores de contabilidad cross-region.

---

## Summary

| Fase | Objetivo | Archivos clave | Impacto esperado |
|------|----------|----------------|------------------|
| 1 | Indexes en invoices/payouts/bonuses/audit/… | `lib/db/migrations/0009_*`, schema | −35 % en dashboards admin |
| 2 | Paralelizar queries en pages y acciones | `admin/contractors/[userId]`, `admin-finances.ts` | −150 ms por página |
| 3 | Suspense + `loading.tsx` | `admin/finances/close`, `admin/page`, `contractors/matrix` | −500 a −2 000 ms FCP |
| 4 | `next.config.ts` optimisations | `next.config.ts` | −10 KB bundle |
| 5 | Eliminar `'use client'` innecesario | 3 form wrappers | −12 KB hydration |
| 6 | Code-split kanban + pricing-slider | `components/kanban/**`, `components/pricing-slider/**` | −25 KB gzipped |
| 7 | `revalidateTag` en lugar de `revalidatePath` | `app/actions/admin-*.ts`, `lib/cache/tags.ts` | Nav instantánea |
| 8 | Route-level `revalidate` | `finances/invoices`, `contractors/matrix`, `audit` | Near-zero DB en nav |
| 9 | Agregar totales en una sola query | `admin-finances.ts`, `finances/close` | 2 000 ms → 300 ms |
| 10 | Quitar deps muertas + posthog lazy | `package.json` | −20 a −90 KB bundle |
| 11 | Traducciones de status + fixes QA | mensajes + 5 páginas admin | Parity + bilingüismo real |
| 12 | Observabilidad + budgets | analytics + bundle analyzer + Lighthouse CI | Regresiones visibles |
| 13 | i18n de `/admin/brands/[brandId]/plan` | namespace `admin.brandPlan.*` + página + form de override | Bug visual cerrado, ~10 literales menos |
| 14 | Pool de comisiones por marca (USD + COP) | schema nuevo + 4 server actions + UI allocations + enforcement en payouts + cierre bi-divisa | Techo real por contratista, cierre COP/USD sin bleed |

Cada fase va a un PR propio. El orden importa: las fases 1–3 bajan p50 en producción; 4–6 bajan el bundle inicial; 7–9 hacen el stack más elástico; 10–12 cierran deuda y previenen regresiones; 13 limpia i18n residual; 14 cierra el gap operativo de comisiones bi-divisa.
