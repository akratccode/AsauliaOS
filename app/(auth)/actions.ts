'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { brandMembers, contractorProfiles, invitations, users } from '@/lib/db/schema';
import { createSupabaseServerClient } from '@/lib/auth/supabase-server';
import { getSupabaseAdminClient } from '@/lib/auth/supabase-admin';
import { loginLimiter, passwordResetLimiter } from '@/lib/auth/rate-limit';
import { env } from '@/lib/env';

export type AuthErrorCode =
  | 'invalid_credentials'
  | 'rate_limited'
  | 'account_creation_failed'
  | 'invalid_invitation'
  | 'validation'
  | 'password_too_short'
  | 'reset_too_many_requests'
  | 'reset_failed'
  | 'generic';

export type AuthInfoCode = 'reset_info';

export type ActionState =
  | { error?: AuthErrorCode; info?: AuthInfoCode }
  | undefined;

function extractIp(forwarded: string | null): string {
  if (!forwarded) return 'unknown';
  const first = forwarded.split(',')[0]?.trim();
  return first || 'unknown';
}

async function landingForRole(userId: string): Promise<string> {
  const rows = await db
    .select({ role: users.globalRole })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const role = rows[0]?.role ?? 'client';
  if (role === 'admin' || role === 'operator') return '/admin/brands';
  if (role === 'contractor') return '/tasks';
  const membership = await db
    .select({ brandId: brandMembers.brandId })
    .from(brandMembers)
    .where(eq(brandMembers.userId, userId))
    .limit(1);
  return membership[0] ? '/dashboard' : '/onboarding/brand';
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function signInAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { error: 'invalid_credentials' };
  }

  const hdrs = await headers();
  const ip = extractIp(hdrs.get('x-forwarded-for'));
  const key = `login:${parsed.data.email.toLowerCase()}:${ip}`;
  const limited = await loginLimiter.limit(key);
  if (!limited.success) {
    return { error: 'rate_limited' };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    return { error: 'invalid_credentials' };
  }

  const next = (formData.get('next') as string | null) ?? (await landingForRole(data.user.id));
  redirect(next);
}

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1).max(120),
  inviteToken: z.string().optional(),
  requestedRole: z.enum(['client', 'contractor']).optional(),
});

export async function signUpAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = signupSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    fullName: formData.get('fullName'),
    inviteToken: formData.get('inviteToken') || undefined,
    requestedRole: formData.get('requestedRole') || undefined,
  });
  if (!parsed.success) {
    return { error: 'validation' };
  }

  let invite: typeof invitations.$inferSelect | undefined;
  if (parsed.data.inviteToken) {
    const rows = await db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.token, parsed.data.inviteToken),
          isNull(invitations.acceptedAt),
          gt(invitations.expiresAt, new Date()),
        ),
      )
      .limit(1);
    invite = rows[0];
    if (!invite || invite.email.toLowerCase() !== parsed.data.email.toLowerCase()) {
      return { error: 'invalid_invitation' };
    }
  }

  const supabase = await createSupabaseServerClient();
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${env.NEXT_PUBLIC_APP_URL}/verify-email`,
      data: { full_name: parsed.data.fullName, password_set_at: nowIso },
    },
  });

  if (error || !data.user) {
    return { error: 'account_creation_failed' };
  }

  const resolvedRole = invite
    ? globalRoleFromInvite(invite)
    : parsed.data.requestedRole === 'contractor'
      ? 'contractor'
      : 'client';

  const admin = getSupabaseAdminClient();
  await admin.from('users').upsert(
    {
      id: data.user.id,
      email: parsed.data.email,
      full_name: parsed.data.fullName,
      global_role: resolvedRole,
      password_set_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );

  if (resolvedRole === 'contractor') {
    await db
      .insert(contractorProfiles)
      .values({ userId: data.user.id, status: 'pending' })
      .onConflictDoNothing({ target: contractorProfiles.userId });
  }

  if (invite) {
    if (invite.scope === 'brand' && invite.brandId) {
      await db
        .insert(brandMembers)
        .values({
          brandId: invite.brandId,
          userId: data.user.id,
          role: invite.role as 'owner' | 'member',
          acceptedAt: new Date(),
        })
        .onConflictDoNothing();
    }
    await db
      .update(invitations)
      .set({ acceptedAt: new Date() })
      .where(eq(invitations.id, invite.id));
  }

  if (data.session) {
    redirect(await landingForRole(data.user.id));
  }
  redirect('/verify-email');
}

function globalRoleFromInvite(invite: typeof invitations.$inferSelect) {
  if (invite.scope === 'global') {
    return invite.role as 'admin' | 'operator' | 'contractor';
  }
  return 'client';
}

const resetRequestSchema = z.object({ email: z.string().email() });

export async function requestPasswordResetAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = resetRequestSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) {
    return { info: 'reset_info' };
  }

  const hdrs = await headers();
  const ip = extractIp(hdrs.get('x-forwarded-for'));
  const limited = await passwordResetLimiter.limit(`reset:${parsed.data.email.toLowerCase()}:${ip}`);
  if (!limited.success) {
    return { error: 'reset_too_many_requests' };
  }

  const supabase = await createSupabaseServerClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${env.NEXT_PUBLIC_APP_URL}/reset-password/confirm`,
  });
  return { info: 'reset_info' };
}

const resetConfirmSchema = z.object({ password: z.string().min(8) });

export async function confirmPasswordResetAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = resetConfirmSchema.safeParse({ password: formData.get('password') });
  if (!parsed.success) {
    return { error: 'password_too_short' };
  }
  const supabase = await createSupabaseServerClient();
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase.auth.updateUser({
    password: parsed.data.password,
    data: { password_set_at: nowIso },
  });
  if (error) return { error: 'reset_failed' };
  if (data.user) {
    await db
      .update(users)
      .set({ passwordSetAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, data.user.id));
  }
  redirect('/login');
}

export async function setInitialPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = resetConfirmSchema.safeParse({ password: formData.get('password') });
  if (!parsed.success) {
    return { error: 'password_too_short' };
  }
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: 'generic' };

  const nowIso = new Date().toISOString();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
    data: { password_set_at: nowIso },
  });
  if (error) return { error: 'reset_failed' };

  await db
    .update(users)
    .set({ passwordSetAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, userData.user.id));

  redirect('/dashboard');
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/login');
}
