# Phase 03 — Authentication & Authorization

## Objective
Implement end-to-end auth: signup, login, logout, password reset, email verification, invitations, and a hardened RBAC helper used by every protected route.

## Depends on
Phase 02 (database).

## Unlocks
Phases 05, 06, 08, 09, 10.

---

## Tasks

### 1. Supabase client setup

Create three distinct clients per Supabase's SSR guidance.

- [ ] `lib/auth/supabase-browser.ts` — client for browser components.
- [ ] `lib/auth/supabase-server.ts` — server components / server actions client (reads cookies).
- [ ] `lib/auth/supabase-admin.ts` — service-role client (server-only, never imported into client components). Guard it with an `import "server-only"` at the top.

Follow the `@supabase/ssr` patterns exactly — using the wrong client leaks either perms or sessions.

### 2. Middleware

- [ ] Create `middleware.ts` at the project root that:
  1. Refreshes the Supabase session on every request.
  2. Redirects unauthenticated requests away from `(client)`, `(contractor)`, `(admin)` route groups to `/login`.
  3. After login, redirects to the user's default landing based on `global_role`:
     - `admin` / `operator` → `/admin/brands`
     - `contractor` → `/tasks`
     - `client` → `/dashboard` (or `/onboarding` if they have no brand yet)
- [ ] Exclude `api/webhooks/*`, static assets, auth routes from the middleware matcher.

### 3. Auth pages

Under `app/(auth)/`:

- [ ] `/login` — email + password. Use shadcn Form. Show inline errors. Include "Forgot password?" link.
- [ ] `/signup` — email + password + full name. Separate flows:
  - Plain signup → creates a user with `global_role = 'client'`; redirects to onboarding (Phase 05).
  - Invitation signup (see §5) → consumes an invite token, assigns the correct role.
- [ ] `/reset-password` — request a reset link.
- [ ] `/reset-password/confirm` — set a new password from the emailed link.
- [ ] `/verify-email` — display a "check your inbox" message after signup; handle Supabase email confirmation callback.

All forms use server actions, not API routes. Error messages never leak whether an email exists (avoid account enumeration).

### 4. User row sync

Supabase `auth.users` and our `public.users` table must stay in sync.

- [ ] Create a Postgres trigger: on insert into `auth.users`, insert a matching row into `public.users` with `email` copied and `global_role = 'client'` as default.
- [ ] Create a trigger on update to sync email changes.
- [ ] Run these as a migration in `lib/db/migrations/` or a dedicated `supabase/migrations/` file.

### 5. Invitations

Asaulia admins invite contractors and operators; client owners invite brand members. Design:

Table `invitations`:
- `id` (uuid, PK)
- `email` (text, not null)
- `token` (text, unique, not null) — long random string.
- `invited_by_user_id` (uuid, FK)
- `brand_id` (uuid, FK, nullable) — NULL for global admin/operator/contractor invites.
- `scope` enum `'global' | 'brand'`
- `role` (text) — for global: 'admin' | 'operator' | 'contractor'; for brand: 'owner' | 'member'.
- `expires_at` (timestamptz, default now() + 7 days)
- `accepted_at` (timestamptz)
- `created_at`

Add this table in a migration from this phase (not Phase 02, which was structural).

Flow:
1. Admin or owner calls a server action with `(email, scope, role, brand_id?)`.
2. Server creates a row, emails a signed link `https://app/signup?invite=<token>`.
3. User clicks, fills signup form. On submit, server:
   - Validates token (exists, not expired, not accepted).
   - Creates the Supabase user.
   - Sets `public.users.global_role` per the invite (bypassing the default).
   - If `scope = brand`, inserts into `brand_members` with the invite's role.
   - Marks invite accepted.
4. Redirect to role-appropriate landing.

### 6. RBAC core

Create `lib/auth/rbac.ts` exporting:

```ts
export type AuthContext = {
  userId: string;
  email: string;
  globalRole: 'admin' | 'operator' | 'contractor' | 'client';
};

export type BrandContext = AuthContext & {
  brandId: string;
  brandRole: 'owner' | 'member' | null; // null if global admin accessing any brand
};

export async function requireAuth(): Promise<AuthContext> { /* ... */ }
export async function requireRole(roles: AuthContext['globalRole'][]): Promise<AuthContext> { /* ... */ }
export async function requireBrandAccess(brandId: string, allowedBrandRoles?: ('owner' | 'member')[]): Promise<BrandContext> { /* ... */ }
export async function requireAdmin(): Promise<AuthContext> { /* ... */ }
```

Rules:
- `requireAuth()` throws a `401 Unauthorized` redirect if no session.
- `requireRole(['admin'])` throws `403 Forbidden` if user role not in the list.
- `requireBrandAccess(brandId)` passes if user is admin/operator OR is a member of that brand. Optionally restrict by brand role.
- Every server action and API route starts with one of these four calls.

Create a typed `Forbidden` and `Unauthorized` error class that the nearest error boundary or handler converts to the right HTTP status / redirect.

### 7. Logout

- [ ] `/logout` route that calls `supabase.auth.signOut()` and redirects to `/login`.

### 8. Session header component

- [ ] `components/auth/user-menu.tsx` — avatar + dropdown with "Profile", "Settings", "Logout".
- [ ] Used in the top nav of every authenticated layout.

### 9. Email templates

- [ ] In Supabase dashboard, customize the email templates for: Confirm signup, Magic Link, Reset Password, Invite User. Use Asaulia branding placeholder.
- [ ] For transactional emails we send (invites), use Resend via `lib/notifications/email.ts` stub (implemented fully in Phase 12 — for now, a simple sender that Resend-ifies the content).

### 10. Rate limiting

- [ ] Add Upstash Redis or `@upstash/ratelimit`. Alternative: Vercel KV.
- [ ] Limit login attempts: 5 per 10 minutes per email + IP.
- [ ] Limit password reset requests: 3 per hour per email.

---

## Acceptance criteria

- A fresh visitor can sign up, receive a verification email, click the link, and land on `/onboarding`.
- Logging in with wrong password shows a generic error, does not reveal whether the email exists.
- Attempting to visit `/admin/brands` without an admin role redirects or returns 403.
- `requireAuth()` called outside a session throws and the user is sent to `/login`.
- An invitation email contains a link that, when consumed, lands the invitee logged in with the correct role.
- Using an invitation token twice fails on the second attempt.
- Rate limit returns `429` after 5 failed login attempts in 10 minutes.

---

## Tests

Add `tests/unit/rbac.test.ts`:

- `requireRole(['admin'])` given a client-role session throws Forbidden.
- `requireBrandAccess(brandId)` given a user not in `brand_members` throws Forbidden.
- `requireBrandAccess(brandId)` given an admin user succeeds regardless of membership.
- `requireBrandAccess(brandId, ['owner'])` given a 'member' throws Forbidden.

Mock the Supabase session with a factory helper in `tests/helpers/auth.ts`.

Add `tests/integration/invite.test.ts` (Playwright):
- Admin creates an invite → fetches the generated token from the DB → navigates to signup URL → completes → lands in the expected app area.

---

## Notes & gotchas

- Supabase's `auth.users` is not accessible from the browser; queries that need user details must go via `public.users`.
- Cookies: the `@supabase/ssr` helpers set cookies; don't manually write to `Set-Cookie` in server actions or you'll clobber them.
- When updating `global_role` on a user server-side, do it with the service-role client — RLS will block direct updates. Wrap all such operations in `lib/auth/admin-ops.ts` and audit-log them.
- Do NOT implement "magic link" login in v1 — it looks free but creates a phishing surface for invite flows. Password + email confirmation only.
- Keep auth error messages consistent. Any difference between "email not found" and "wrong password" is an enumeration vector.

---

## Next phase

Two phases unblock in parallel from here. Pick based on preference but both must be done before Phase 05:
- `04-pricing-engine.md` — the pricing math module.
- `06-deliverables.md` — deliverables CRUD (also unblocked but depends on 03, so it can start now).

Recommended order: do `04` next — it's small and unblocks onboarding, which is the most user-visible flow.
