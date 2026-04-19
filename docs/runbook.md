# Asaulia operations runbook

This is the on-call cheat sheet. Keep it short and current; append to the
changelog if you modify any operational procedure.

## Deploys

- Push to `main` → Vercel auto-deploys preview, then production.
- Database migrations run as part of the release job
  (`pnpm drizzle-kit migrate`). The job is idempotent — a redeploy with the
  same migration set is a no-op.
- If a deploy goes wrong: revert the offending commit on `main` and let
  Vercel redeploy. For DB regressions, also restore via Supabase PITR (see
  below) before reverting; schema rollback is otherwise on you.

## Rollback

1. `git revert <sha> && git push origin main` — Vercel rolls over.
2. If a migration corrupted data: Supabase dashboard → Database → Backups →
   Point-in-time restore to just before the bad migration ran.
3. Notify `#incidents` with the timeline.

## Stuck Stripe webhook

Symptom: `invoice.paid` fired but no `ledger_entries` row.

1. Find the event ID in Stripe Dashboard → Developers → Events.
2. Confirm it was delivered (200) to our endpoint. If 5xx — check Sentry.
3. If the endpoint 200'd but nothing happened:
   - Check `ledger_entries.stripe_event_id` — if present, it was deduped.
   - If absent, the handler threw after reading the body. Sentry has the
     stack trace.
4. Replay: `stripe events resend <event-id>`. Our handler dedups by event id.

## Failed payout

1. Payout appears in `/admin/finances/payouts` with status=failed.
2. Check `payouts.failure_reason` column. Common:
   - `stripe_connect_incomplete` → contractor must finish onboarding. Email
     them and wait.
   - Account-level errors → contact Stripe support with the payout ID.
3. Once resolved, the next `/api/cron/run-payouts` tick retries (carryover
   is preserved on `contractor_profiles.payout_carryover_cents`).

## Manual cycle close / payout trigger

```
curl -X POST "$APP_URL/api/cron/close-cycles" \
  -H "x-cron-secret: $CRON_SECRET"

curl -X POST "$APP_URL/api/cron/run-payouts" \
  -H "x-cron-secret: $CRON_SECRET"

curl -X POST "$APP_URL/api/cron/dunning" \
  -H "x-cron-secret: $CRON_SECRET"
```

Each is idempotent (guarded by `billing_jobs`).

## Reconciliation

```
pnpm tsx scripts/reconcile.ts $(date +%Y-%m)
```

Exits non-zero on ledger skew. Run nightly in CI; investigate any failure
within one business day.

## Rotate Stripe keys

1. Stripe Dashboard → Developers → API keys → Roll secret key.
2. Update `STRIPE_SECRET_KEY` in Vercel.
3. Redeploy (env change alone doesn't flush serverless containers on all
   regions).
4. Roll webhook secret under Developers → Webhooks → Endpoint → Signing
   secret. Update `STRIPE_WEBHOOK_SECRET`.

## Restore from backup

Supabase Pro+ only. Dashboard → Database → Backups → pick a timestamp.
Restore runs in ~5-30 minutes depending on DB size.

## Third-party incident contacts

- Stripe: https://status.stripe.com + support@stripe.com
- Supabase: https://status.supabase.com + support@supabase.com
- Vercel: https://www.vercel-status.com + support@vercel.com
- Resend: https://status.resend.com + team@resend.com
- Sentry: https://status.sentry.io + support@sentry.io

## Top 10 incidents (and first steps)

1. **Stripe webhook down** → check `/api/webhooks/stripe` in Vercel logs; if 5xx, Sentry has the stack. Replay via Stripe CLI after fix.
2. **Shopify sync stuck** → `/api/cron/sync-integrations` logs; check integration health in `/admin/integrations`.
3. **Payouts failing** → see "Failed payout" above.
4. **Brand can't load dashboard** → check RLS — common cause is a schema change that didn't update policies.
5. **Login broken** → Supabase auth status; verify `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.
6. **Invoice totals wrong** → re-run reconcile; check `plan_snapshot` on the offending invoice row to see what the cycle close captured.
7. **Dunning fired too early** → confirm `brands.past_due_since` and cron secret timing; Policy is day 7 freeze / day 14 cancel (see `lib/billing/policy.ts`).
8. **Email stuck in queue** → Resend dashboard; check domain health (SPF/DKIM/DMARC).
9. **Sentry noise spike** → add the offending rule to `ignoreErrors` and open a ticket.
10. **Cron not firing** → Vercel → Crons — verify schedule is active, not paused.
