# Phase 12 — Notifications, Chat & Launch Polish

## Objective
Close the loop on user communication (email + in-app + chat), polish every flow to launch quality, configure observability, and execute a go-live checklist. This is the phase that turns a working app into a shippable product.

## Depends on
Every prior phase. This phase assumes all happy paths work end-to-end.

## Unlocks
Launch.

---

## Tasks

### 1. Email infrastructure

`lib/notifications/email.ts` — fully implement (previously stubbed in Phase 03).

- [ ] Use Resend + React Email for templates.
- [ ] `pnpm add @react-email/components @react-email/render`.
- [ ] Create a `packages/emails/` directory (or `lib/emails/` since we're single-app) with one template per event:
  - `WelcomeEmail.tsx` (new signup).
  - `InviteEmail.tsx` (team or contractor invite).
  - `DeliverableAssignedEmail.tsx`.
  - `DeliverableApprovedEmail.tsx` (to contractor).
  - `DeliverableRejectedEmail.tsx` (to contractor).
  - `InvoiceIssuedEmail.tsx` (to client owner).
  - `InvoicePaidEmail.tsx` (confirmation to client owner).
  - `PaymentFailedEmail.tsx` (to client owner).
  - `CycleCloseSummaryEmail.tsx` (monthly summary to client owner).
  - `PayoutSentEmail.tsx` (to contractor).
  - `PayoutFailedEmail.tsx` (to contractor + admin).
  - `PlanChangeConfirmedEmail.tsx`.
  - `PasswordResetEmail.tsx` (if not using Supabase's default).
- [ ] A single sender: `sendEmail({ to, template, props, replyTo? })` that renders React, sends via Resend, returns message ID.
- [ ] Every email includes plain-text fallback via `@react-email/render`.

Deliverability:
- [ ] Set up SPF, DKIM, DMARC records for `asaulia.com` (or dev domain).
- [ ] Use a `from: "Asaulia <no-reply@mail.asaulia.com>"` subdomain so the main domain's deliverability isn't affected by transactional mail.
- [ ] Every email has an unsubscribe link for non-transactional types only (digest emails, announcements). Transactional (invoices, payouts, payment-failed) cannot be unsubscribed.

### 2. In-app notifications (complete)

Extend the bell dropdown stubbed in Phase 08.

- [ ] Service `lib/notifications/inapp.ts`:
  - `createNotification({ userId, type, title, body, linkUrl, meta })` writes to `notifications`.
  - Bulk helper for system events (e.g. "deliverable approved" notifies contractor + mentions).
- [ ] Realtime updates: subscribe to `notifications` changes for the logged-in user via Supabase Realtime:
  - In `app/(client)/layout.tsx` (and contractor + admin layouts), add a small client component that subscribes and invalidates the TanStack Query cache for notifications.
- [ ] Settings: preferences page to mute notification types. Table `notification_preferences`:
  - `user_id`, `type`, `channel ('email' | 'inapp')`, `enabled`.
- [ ] All `sendEmail` calls check preferences first. All `createNotification` calls similarly.

Coverage: every email above has a matching in-app notification (paired by type).

### 3. Chat — client ↔ Asaulia team

Simple threaded chat per brand. Asynchronous.

Scope: one thread per brand. Messages visible to all brand members + assigned admins/operators. Contractors do NOT have chat in v1 — they communicate via deliverable comments.

Schema:
- `chat_threads`: `id`, `brand_id` (unique), `created_at`, `last_message_at`.
- `chat_messages`: `id`, `thread_id`, `user_id`, `content`, `attachment_ids` (uuid[]), `created_at`, `edited_at`, `deleted_at`.
- `chat_message_attachments`: similar to deliverable attachments.
- `chat_participants`: `thread_id`, `user_id`, `last_read_at`, for unread counts.

UI: `/(client)/chat` and `/(admin)/brands/[brandId]/chat`:
- Message list (infinite scroll upward).
- Compose box with attachments.
- Typing indicator (optional; use Supabase Realtime presence).
- Unread badge in sidebar.

Notifications: new message → in-app bell + email digest (batched hourly).

### 4. Observability polish

Sentry:
- [ ] Verify source maps uploaded on each deploy (via Sentry CLI in CI).
- [ ] Create alerts: error rate > 2% over 10 min; failed webhook rate > 0%; p95 API latency > 2s.
- [ ] Tag events with `brand_id` and `user_id` for easy filtering (respecting PII minimization).

PostHog:
- [ ] Capture key events:
  - `signup_completed`
  - `onboarding_brand_saved`, `onboarding_plan_saved`, `onboarding_payment_succeeded`
  - `deliverable_created`, `deliverable_moved`
  - `integration_connected`, `integration_synced`
  - `plan_changed`
  - `invoice_paid`, `payout_sent`
- [ ] Feature flags: wrap risky new features (e.g. the automated payout job) so they can be disabled without a deploy.
- [ ] Create a funnel for signup → first invoice paid.

Logs:
- [ ] Use `pino` for structured logs in server code. Ship to Logtail/Axiom or use Vercel's built-in.
- [ ] Never log PII, credentials, webhook bodies, or Stripe secret data.

### 5. Performance

- [ ] Run Lighthouse on every major page in prod-mode locally. Fix anything scoring < 90 performance.
- [ ] Lazy-load the Kanban board (it's heavy with @dnd-kit).
- [ ] Image optimization: all avatars and logos served via Next's `<Image>` component.
- [ ] Database: review slow queries with `EXPLAIN ANALYZE` for the dashboard's main aggregate queries; add indexes where needed. Specifically:
  - `sales_records (brand_id, attributed, occurred_at)` — used by dashboard + invoice.
  - `deliverables (brand_id, period_start, status)` — used by Kanban.
  - `payouts (contractor_user_id, period_start)` — used by earnings history.
- [ ] CDN: ensure Vercel's default is caching static assets; confirm `cache-control` on `next/image` endpoints.

### 6. Security final pass

- [ ] Audit every server action for `authorize()`. Grep for `"use server"` and verify each file starts with one.
- [ ] Run `npm audit --production`; resolve all critical/high vulns.
- [ ] Rotate every production secret that was created during development.
- [ ] Confirm RLS is ENABLED on every tenant table: `SELECT c.relname, c.relrowsecurity FROM pg_class c WHERE c.relkind = 'r' AND c.relnamespace = 'public'::regnamespace;` — all tenant tables should show `t`.
- [ ] CSP headers: set via `next.config.js` with a strict policy. Start with report-only mode, fix violations, then enforce.
- [ ] Rate limiting on:
  - `/api/integrations/shopify/install` — prevent OAuth bombing.
  - `/api/deliverables` POST — 60/min/user.
  - `/api/sales/manual` — already capped in Phase 10.

### 7. Accessibility

- [ ] Run `axe` against every page. Fix all blocker and critical issues.
- [ ] Keyboard navigation through the full app: tab order must be sensible, no traps.
- [ ] Color contrast: all text meets WCAG AA.
- [ ] Form error messages associated with inputs via `aria-describedby`.
- [ ] Screen reader pass on the Kanban: cards are focusable list items, drag uses keyboard mode per `@dnd-kit` docs.

### 8. Internationalization baseline

Not a full i18n effort in v1 — just the groundwork:
- [ ] Wrap every hardcoded string in a `t("key")` call from `next-intl`. Start with one locale `en`.
- [ ] Number/currency/date formatting via the user's locale (already via `Intl.*` — verify).
- [ ] Timezone: user's timezone preference respected everywhere.

Spanish localization can follow as a v1.1 drop.

### 9. Legal & comms

- [ ] Terms of Service, Privacy Policy, DPA pages. Link from signup and footer.
- [ ] Cookie consent banner (GDPR-lite) — only if targeting EU. Defer if US-only launch.
- [ ] Marketing landing page (`app/(marketing)/page.tsx`) — simple but branded; real copy.
- [ ] Help Center link — can be a Notion page in v1.

### 10. Launch checklist

Use this as the go/no-go gate. Every item must be checked.

```
INFRA
[ ] Production Supabase project created, RLS verified, extensions enabled.
[ ] Production Stripe account, Connect enabled, smart retries enabled.
[ ] Production Resend domain verified, DNS records confirmed.
[ ] Vercel production environment variables all set, including CRON_SECRET.
[ ] Vercel crons scheduled (sync-integrations, close-cycles, run-payouts, dunning).
[ ] Sentry production project, alerts configured, on-call rotation set.
[ ] PostHog production project, key funnels built.
[ ] Domain pointing to Vercel with HTTPS.

DATA
[ ] Production DB seeded with: Asaulia admin account only. No test data.
[ ] Backup schedule verified (Supabase nightly is default).
[ ] DB migration pipeline tested: applying a new migration doesn't break the app.

SECURITY
[ ] All secrets rotated from dev-time values.
[ ] Penetration test (self-run or external) on auth + billing endpoints.
[ ] Stripe webhook endpoint verified with Stripe CLI in prod.
[ ] Shopify webhook HMAC verified with live traffic.
[ ] No `.env.local` committed. `git log -p -- .env.local` empty.

QUALITY
[ ] All Playwright E2E tests pass against the production URL (use a test account).
[ ] Manual smoke test by 2 people who did not write the code.
[ ] Lighthouse scores >= 90 on dashboard, sales, deliverables pages.
[ ] Mobile view verified on iOS + Android real devices.

DOCUMENTATION
[ ] README updated with production URL and current version.
[ ] Internal runbook: how to rotate Stripe keys, restore from backup, replay a failed webhook, resend a failed payout.
[ ] Deploy procedure documented.
[ ] On-call handbook: top 10 incident types and responses.

BUSINESS
[ ] Pricing page public on marketing site.
[ ] ToS and Privacy Policy published.
[ ] Support email (support@asaulia.com) monitored.
[ ] First 3 design-partner brands identified and briefed.
```

### 11. Deployment runbook

Create `docs/runbook.md` documenting:
- How deploys work (push to main → Vercel auto-deploys → run migrations).
- How to roll back (revert commit, redeploy).
- How to recover from a bad migration (Supabase point-in-time restore).
- How to handle a stuck Stripe webhook (replay via Stripe CLI).
- How to manually trigger cycle close / payout jobs (curl with CRON_SECRET).
- How to impersonate as admin (see Phase 10).
- Contacts for third-party incidents (Stripe, Supabase, Vercel, Resend).

### 12. Launch rehearsal

- [ ] Day-0 rehearsal: spin up a staging copy, run the full onboarding + first cycle + first payout end-to-end in under 30 minutes with the team watching.
- [ ] Document every defect found and fix before launch.
- [ ] Schedule launch window for a low-risk time (Tuesday–Thursday morning in the primary user timezone).

---

## Acceptance criteria

- Every item in the launch checklist is checked.
- A fresh brand can go from signup to paid first invoice to first payout to a contractor, end-to-end, in a production-like environment with no manual intervention beyond initial admin setup.
- An error triggered intentionally in production appears in Sentry within 1 minute.
- Ten parallel test users load the dashboard simultaneously and the p95 response time stays under 1.5s.
- Disabling a feature flag in PostHog hides the corresponding feature from users without a deploy.

---

## Tests

- Full end-to-end Playwright suite against a staging environment that mirrors production.
- Backup restoration drill: restore yesterday's backup into a scratch project, verify data integrity.

---

## Notes & gotchas

- **Email deliverability:** brand-new domains get sandboxed by Gmail/Outlook for 1–2 weeks. Warm up by sending gradually (start with internal, then test brands, then real traffic).
- **Realtime on Vercel:** Supabase Realtime works fine with Vercel's serverless runtime because the WebSocket is client-side to Supabase, not our server. Verify in production.
- **Stripe Connect live mode activation:** takes a few business days to get approved. Start the application early (Phase 11 can be done in test mode; Phase 12 needs live).
- **Crons on Vercel Hobby vs Pro:** Hobby has a 2/day cron limit. We need at least 4 crons (sync, close, payouts, dunning). Must be on Pro or higher plan.
- **First-cycle math bug magnet:** the most common bug is off-by-one-day on period boundaries. Add a specific test that creates a brand at Oct 15 00:00 brand-tz, runs a cycle close at Nov 15 00:00 brand-tz, and asserts the period is exactly 31 days (or 30/29/28 depending on month).
- **Launch communication:** the client owners of the first brands should know what they're getting into. Over-communicate about cycle timing, variable billing, and how to read their first invoice. A 10-minute Loom video reduces support load more than any doc.

---

## Post-launch

Not in this phase but worth tracking as a living backlog:

1. Spanish localization + PT-BR.
2. Additional integrations: Meta Ads attribution, GA4, HubSpot, Klaviyo.
3. Contractor time tracking (optional tool).
4. Referral program.
5. Annual billing option with discount.
6. Mobile apps.
7. Multi-currency.
8. SSO for enterprise brands.
9. White-label.
10. AI-assisted contractor matching for new briefs.

Build from real user demand, not hypothesis.

---

## End of PRD

You shipped it. Make sure `CHANGELOG.md` reflects every phase's user-visible changes. Tag the release `v1.0.0` on main.
