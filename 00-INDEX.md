# Phase Index & Dependency Graph

## Read order

Every phase lives in its own file. Do one at a time. Don't skip ahead.

| # | File | Depends on | Unlocks |
| - | ---- | ---------- | ------- |
| 01 | `01-foundation.md` | — | all |
| 02 | `02-database.md` | 01 | 03, 04, 06, 07 |
| 03 | `03-auth.md` | 02 | 05, 06, 08, 09, 10 |
| 04 | `04-pricing-engine.md` | 02 | 05, 11 |
| 05 | `05-client-onboarding.md` | 03, 04 | 08 |
| 06 | `06-deliverables.md` | 03 | 08, 09 |
| 07 | `07-integrations.md` | 02 | 08, 11 |
| 08 | `08-client-dashboard.md` | 05, 06, 07 | 12 |
| 09 | `09-contractor-portal.md` | 06 | 12 |
| 10 | `10-admin-console.md` | 05, 06, 07, 09 | 12 |
| 11 | `11-billing-payouts.md` | 04, 07 | 12 |
| 12 | `12-polish-launch.md` | all | — |

## Visual dependency graph

```
                 ┌──────────────┐
                 │ 01 Foundation│
                 └──────┬───────┘
                        │
                 ┌──────┴───────┐
                 │ 02 Database  │
                 └─┬────┬────┬──┘
                   │    │    │
      ┌────────────┘    │    └────────────┐
      ▼                 ▼                 ▼
┌────────────┐   ┌──────────────┐   ┌──────────────┐
│  03 Auth   │   │ 04 Pricing   │   │ 07 Integr.   │
└──┬────┬────┘   └──────┬───────┘   └──────┬───────┘
   │    │               │                  │
   │    │   ┌───────────┘                  │
   │    │   │                              │
   ▼    ▼   ▼                              │
┌────────────┐   ┌──────────────┐          │
│06 Delivr.  │   │ 05 Onboard   │          │
└──┬────┬────┘   └──────┬───────┘          │
   │    │               │                  │
   └────┴─────────┬─────┘──────────────────┘
                  ▼
           ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
           │ 08 Client   │    │ 09 Contrct. │    │ 10 Admin    │
           └──────┬──────┘    └──────┬──────┘    └──────┬──────┘
                  │                  │                  │
                  │  ┌───────────────┘                  │
                  │  │  ┌───────────────────────────────┘
                  ▼  ▼  ▼
              ┌──────────────┐
              │ 11 Billing   │
              └──────┬───────┘
                     │
                     ▼
              ┌──────────────┐
              │ 12 Polish    │
              └──────────────┘
```

## Phase completion checklist (same for every phase)

A phase is "done" when:

- [ ] All tasks in the phase file are checked off.
- [ ] `pnpm typecheck` passes with zero errors.
- [ ] `pnpm lint` passes.
- [ ] `pnpm test` passes with the new tests included.
- [ ] Database migrations (if any) applied locally and checked in.
- [ ] New env vars documented in `.env.example`.
- [ ] `CHANGELOG.md` updated with a line item per user-visible change.
- [ ] A manual smoke test of the acceptance criteria passes.
- [ ] The "Next phase" section of the phase file is reviewed and any gotchas surfaced before moving on.

## What to do when stuck

1. Re-read the phase file, the PRD section relevant to the phase, and ARCHITECTURE.md.
2. If still ambiguous, stop and ask the user. Do not invent product decisions.
3. If blocked by an earlier phase (missing function, schema, route), open the earlier phase file, verify it was done correctly, fix if necessary, and note the fix in `CHANGELOG.md`.
4. Never stub out a feature from a prior phase to "keep moving." Fix it properly or escalate.
