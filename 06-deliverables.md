# Phase 06 — Deliverables System

## Objective
Build the deliverables CRUD, the assignment model, the Kanban UI, comments, attachments, and the activity log. This is the shared backbone used by all three personas (clients view their deliverables, contractors work their tasks, admin orchestrates).

## Depends on
Phase 03 (auth + RBAC).

## Unlocks
Phase 08 (client dashboard), Phase 09 (contractor portal).

---

## Tasks

### 1. API surface

All endpoints live under `app/api/deliverables/` and use server actions where called from our own UI. Public shape (for the admin console and client dashboard):

- `GET /api/deliverables?brandId=...&period=YYYY-MM` — list deliverables for a brand+period.
- `POST /api/deliverables` — create (admin only).
- `PATCH /api/deliverables/:id` — update (admin, or the assignee for status transitions `in_progress`, `in_review`).
- `DELETE /api/deliverables/:id` — soft-delete (admin only; adds an `archived_at` column — extend schema).
- `POST /api/deliverables/:id/comments` — add a comment.
- `POST /api/deliverables/:id/attachments` — upload an attachment (returns a Storage URL).
- `GET /api/deliverables/:id/activity` — fetch activity log.

Each endpoint calls `authorize()` and returns `Result` shapes.

### 2. Server functions

File `lib/deliverables/service.ts` with:

```ts
createDeliverable(input: {...}): Promise<Deliverable>
updateDeliverableStatus(id: string, nextStatus: DeliverableStatus, actorId: string): Promise<Deliverable>
assignDeliverable(id: string, assigneeUserId: string, actorId: string): Promise<Deliverable>
addComment(deliverableId: string, userId: string, content: string): Promise<DeliverableComment>
addAttachment(deliverableId: string, userId: string, file: UploadedFile): Promise<DeliverableAttachment>
listDeliverablesForBrand(brandId: string, period: { start: Date; end: Date }): Promise<Deliverable[]>
listDeliverablesForContractor(userId: string): Promise<Deliverable[]>
```

Every mutation also appends a row to `deliverable_activity`.

### 3. Status transition rules

Enforce in `updateDeliverableStatus`:

```
todo          → in_progress   (assignee or admin)
in_progress   → in_review     (assignee or admin)
in_review     → done          (admin or client owner — "approve")
in_review     → rejected      (admin or client owner — "reject", loops back)
rejected      → in_progress   (assignee or admin)
done          → in_review     (admin only — "reopen")
```

Any other transition returns a `400 invalid_transition`. This matters because `done` counts toward the contractor payout (Phase 04 `distribute`).

### 4. Fixed-share allocation

The admin, when scoping deliverables for a period, allocates each a `fixed_share_bps`. Validation:

- Sum of `fixed_share_bps` for the brand+period should equal 10000 (100%).
- The admin UI should surface a running-total indicator while editing.
- On save, if sum != 10000, allow with a warning but mark the period as "under-allocated" or "over-allocated" so billing can flag it.
- Hard block: no single deliverable can have `fixed_share_bps > 5000` (50%) — a safety rail against an admin making one task 100% by accident.

Helper: `lib/deliverables/allocation.ts` with `validateAllocation(brandId, period)`.

### 5. Kanban component

`components/kanban/Board.tsx`:

Layout: 5 columns — `Todo`, `In progress`, `In review`, `Done`, `Rejected`. Each column shows:
- Column title + count of cards + sum of `fixed_share_bps` in that column (as %).
- Cards, each with: title, type tag, assignee avatar, due date, share %, number of comments, number of attachments.

Interactions:
- Click a card → opens a side sheet (`components/kanban/DeliverableSheet.tsx`) with full detail, comments, attachments, activity.
- Drag-and-drop for status changes, client-side optimistic update + server reconciliation. Use `@dnd-kit/core` (lightweight, accessible). Drags that violate the transition rules snap back with a toast.
- Keyboard accessible: arrow-key navigation between cards, `Enter` to open, context menu for status.

Library: `pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`.

### 6. Attachments

- Files stored in a private Supabase Storage bucket `deliverable-attachments`.
- Path convention: `brand_{brand_id}/deliverable_{deliverable_id}/{uuid}-{original_name}`.
- Max file size: 25 MB. Enforced client-side (block upload before it starts) and server-side (reject if exceeds).
- Allowed MIME types: a configurable allow-list (images, PDFs, docs, common design files). See `lib/deliverables/attachments.ts` for the list.
- Signed URLs are generated on-demand with 5-minute expiry for downloads; never expose public URLs.

### 7. Comments & mentions

- Markdown-supported (use `react-markdown` with a safe preset).
- `@user` mentions: autocompleter searches `brand_members` + assigned contractors of the brand. On save, persist mentions in a `deliverable_comment_mentions` side table for quick notification lookup later (Phase 12).

### 8. Activity feed

Every create / status change / assign / comment / attachment logs to `deliverable_activity`. Display in the side sheet as a reverse-chronological timeline:

- "Ana created this deliverable." — 2d ago
- "Bruno moved it to In progress." — 1d ago
- "Ana added an attachment: mockup.png." — 20h ago
- "Client approved." — 1h ago

Group same-type events within 5 minutes into a single item ("3 attachments added by Bruno").

### 9. Filters & views

List page `app/(client)/deliverables/page.tsx` (client view) and `app/(admin)/brands/[brandId]/deliverables/page.tsx` (admin view):

- Toggle: Kanban view / List view.
- Filters: period (month picker), assignee, type, status.
- Search: title contains.
- Group-by: period, type, assignee.

URL state reflects filters (`searchParams`). Shareable.

### 10. Permissions matrix

Implemented in the service functions; the UI merely hides buttons the user can't press. The server is the source of truth.

| Action | Admin | Operator | Client owner | Client member | Assignee contractor | Other contractor |
| ------ | ----- | -------- | ------------ | ------------- | ------------------- | ---------------- |
| Create | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Edit title/description | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Change status: → in_progress | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Change status: → in_review | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Change status: → done | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Change status: → rejected | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Assign | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Set fixed_share_bps | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Comment | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Attach | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Delete | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

Operators cannot set `fixed_share_bps` because that's compensation-relevant.

---

## Acceptance criteria

- Admin can create deliverables with all fields.
- Drag-and-drop on the Kanban moves cards and persists to DB.
- Invalid transitions (e.g. client trying to move to `in_progress`) snap back with a toast and don't hit the DB.
- Activity log records every mutation.
- A file upload up to 25 MB succeeds; 26 MB fails.
- Fixed-share allocation UI shows a red banner when sum != 10000 for a period.
- Filters and search persist in the URL.
- Switching views (Kanban / List) preserves filters.
- Page renders in < 500ms for a brand with 50 deliverables.

---

## Tests

Unit (`tests/unit/deliverables.test.ts`):
- Every valid transition succeeds; every invalid transition throws.
- `validateAllocation` returns the correct under/over/exact flag.
- Comment with `@username` mention creates a row in the mentions table.

Integration (`tests/integration/deliverables.e2e.ts`):
- Admin creates 5 deliverables, drags one to `in_progress` as the assignee, confirms status persists on reload.
- Non-assignee contractor sees a 403 when trying to change status.

---

## Notes & gotchas

- **Optimistic updates on drag:** store the previous state; if the server rejects, roll back and toast. Don't loop fetching.
- **Realtime:** out of scope for this phase. Polling on a 30s interval is fine for the MVP. Phase 12 can add Supabase Realtime subscriptions if we need live collaboration.
- **Attachment previews:** images render inline; PDFs show a thumbnail via an icon + filename; others get a file icon. Do not try to render arbitrary file types.
- **Period boundary:** `period_start` and `period_end` align with the brand's billing cycle, not calendar month necessarily. Expose helpers in `lib/billing/period.ts` (stub here, fully implemented in Phase 11).
- **Allocation is NOT required** to create deliverables — admins can draft a period with 0 allocations. Warning only; hard block only applies to invoice issuance in Phase 11.

---

## Next phase

`07-integrations.md` — sales integrations so the variable fee has something to bill.
