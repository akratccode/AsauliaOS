import 'server-only';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { auditLog, contractorProfiles, users } from '@/lib/db/schema';
import { getSupabaseAdminClient } from './supabase-admin';
import { env } from '@/lib/env';

export type InviteByEmailInput =
  | {
      kind: 'client';
      email: string;
      fullName?: string | null;
      invitedByUserId: string;
    }
  | {
      kind: 'contractor';
      email: string;
      fullName?: string | null;
      invitedByUserId: string;
    };

export type InviteByEmailResult =
  | { ok: true; userId: string; reused: boolean }
  | {
      ok: false;
      error:
        | 'role_conflict'
        | 'supabase_invite_failed'
        | 'generic';
    };

const SET_PASSWORD_REDIRECT = '/auth/callback?next=/onboarding/set-password';

/**
 * Creates (or reuses) a `public.users` row for `email` with the right role,
 * triggers a Supabase magic-link invite, and — for contractors — stubs the
 * `contractor_profiles` row. If the email already belongs to a user with an
 * incompatible role (admin/operator/contractor vs client/contractor), we bail
 * with `role_conflict` so the admin can reconcile manually.
 */
export async function inviteUserByEmail(input: InviteByEmailInput): Promise<InviteByEmailResult> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const desiredRole = input.kind === 'contractor' ? 'contractor' : 'client';

  const [existing] = await db
    .select({ id: users.id, email: users.email, role: users.globalRole })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  if (existing) {
    if (existing.role !== desiredRole && existing.role !== 'client') {
      return { ok: false, error: 'role_conflict' };
    }
    if (input.kind === 'contractor' && existing.role === 'client') {
      await db
        .update(users)
        .set({ globalRole: 'contractor', updatedAt: new Date() })
        .where(eq(users.id, existing.id));
    }
    if (input.kind === 'contractor') {
      await db
        .insert(contractorProfiles)
        .values({ userId: existing.id, status: 'pending' })
        .onConflictDoNothing({ target: contractorProfiles.userId });
    }
    return { ok: true, userId: existing.id, reused: true };
  }

  const admin = getSupabaseAdminClient();
  const redirectTo = `${env.NEXT_PUBLIC_APP_URL}${SET_PASSWORD_REDIRECT}`;
  const { data, error } = await admin.auth.admin.inviteUserByEmail(normalizedEmail, {
    redirectTo,
    data: { full_name: input.fullName ?? null, invited_role: desiredRole },
  });
  if (error || !data.user) {
    return { ok: false, error: 'supabase_invite_failed' };
  }

  const userId = data.user.id;
  await db
    .insert(users)
    .values({
      id: userId,
      email: normalizedEmail,
      fullName: input.fullName ?? null,
      globalRole: desiredRole,
      passwordSetAt: null,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: { globalRole: desiredRole, updatedAt: new Date() },
    });

  if (input.kind === 'contractor') {
    await db
      .insert(contractorProfiles)
      .values({ userId, status: 'pending' })
      .onConflictDoNothing({ target: contractorProfiles.userId });
  }

  await db.insert(auditLog).values({
    actorUserId: input.invitedByUserId,
    action: 'user.invited',
    entityType: 'user',
    entityId: userId,
    after: { email: normalizedEmail, role: desiredRole, kind: input.kind },
  });

  return { ok: true, userId, reused: false };
}
