# Asaulia Platform — PRD for Claude Code

> Agency-as-a-service project management platform with a flexible fixed+variable pricing model.

## What you are building

A dual-sided SaaS for **Asaulia**, a growth agency. Brands (clients) subscribe to a flexible plan that combines a fixed monthly fee with a % of attributed sales. Clients see their deliverables progress like a Kanban; contractors see their assigned tasks and earnings; Asaulia admin sees the whole operation.

### The pricing model (core business rule — memorize this)

The client picks any point on a **continuous line** between two anchors:

| Anchor | Fixed (USD/month) | Variable (% of attributed sales) |
| ------ | ----------------- | -------------------------------- |
| Starter | $99 | 20% |
| Pro | $1,000 | 7% |

Linear interpolation:

```
variable_percent = 20 - ((fixed_amount - 99) / 901) * 13
```

- Break-even (both anchors cost the same): attributed sales ≈ $6,931/month.
- Below break-even: Starter is cheaper for the client.
- Above break-even: Pro is cheaper for the client.

### Revenue split (also core)

From whatever the brand pays:
- **Contractors pool:** 40% of the fixed component + 20% of the variable component, distributed across deliverables completed by each contractor for that brand in the billing period.
- **Asaulia:** 60% of fixed + 80% of variable.

## How to read this repository

1. Read `PRD.md` first — full product vision in one pass.
2. Read `ARCHITECTURE.md` — tech stack, conventions, folder layout.
3. Then open `phases/00-INDEX.md` — dependency graph and phase order.
4. Implement one phase at a time. Each phase lives in its own file (`phases/01-*.md` ... `phases/12-*.md`). Do not load multiple phases into context simultaneously unless explicitly cross-referenced.

## Implementation rules for Claude Code

1. **One phase per session.** Finish a phase fully before starting the next.
2. **Always run `pnpm typecheck` and `pnpm test` before closing a phase.** A phase is not done if either fails.
3. **Do not deviate from the stack.** `ARCHITECTURE.md` is contractual.
4. **Never hardcode pricing constants.** Always import from `@/lib/pricing/constants`.
5. **All money values in cents (integers).** Never floats. Display formatting happens only at the UI layer.
6. **All times in UTC.** Display in user timezone only at the UI layer.
7. **Write tests as you go.** Each phase has its own `tests` section — those are non-negotiable.
8. **If a task seems ambiguous, ask before coding.** The PRD is the source of truth; assumptions are not.

## Phase summary

| # | Name | Unlocks |
| - | ---- | ------- |
| 01 | Foundation & tooling | all |
| 02 | Database schema | 03, 04, 06, 07 |
| 03 | Authentication & RBAC | 05, 06, 08, 09, 10 |
| 04 | Pricing engine | 05, 11 |
| 05 | Client onboarding | 08 |
| 06 | Deliverables system | 08, 09 |
| 07 | Sales attribution & integrations | 08, 11 |
| 08 | Client dashboard | 12 |
| 09 | Contractor portal | 12 |
| 10 | Admin console | 12 |
| 11 | Billing & payouts | 12 |
| 12 | Notifications, chat & launch polish | launch |

Start at phase 01.
