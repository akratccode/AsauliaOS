'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { brandMembers, invitations, users } from '@/lib/db/schema';
import { createSupabaseServerClient } from '@/lib/auth/supabase-server';
import { getSupabaseAdminClient } from '@/lib/auth/supabase-admin';
import { loginLimiter, passwordResetLimiter } from '@/lib/auth/rate-limit';
import { env } from '@/lib/env';

const GENERIC_AUTH_ERROR =
  "We couldn't sign you in with those credentials. Double-check and try again.";

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

export type ActionState = { error?: string; info?: string } | undefined;

export async function signInAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { error: GENERIC_AUTH_ERROR };
  }

  const hdrs = await headers();
  const ip = extractIp(hdrs.get('x-forwarded-for'));
  const key = `login:${parsed.data.email.toLowerCase()}:${ip}`;
  const limited = await loginLimiter.limit(key);
  if (!limited.success) {
    return { error: 'Too many attempts. Try again in a few minutes.' };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    return { error: GENERIC_AUTH_ERROR };
  }

  const next = (formData.get('next') as string | null) ?? (await landingForRole(data.user.id));
  redirect(next);
}

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1).max(120),
  inviteToken: z.string().optional(),
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
  });
  if (!parsed.success) {
    return { error: 'Please check the form and try again.' };
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
      return { error: 'This invitation is no longer valid.' };
    }
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${env.NEXT_PUBLIC_APP_URL}/verify-email`,
      data: { full_name: parsed.data.fullName },
    },
  });

  if (error || !data.user) {
    return { error: "We couldn't create that account. Try a different email." };
  }

  const admin = getSupabaseAdminClient();
  await admin.from('users').upsert(
    {
      id: data.user.id,
      email: parsed.data.email,
      full_name: parsed.data.fullName,
      global_role: invite ? globalRoleFromInvite(invite) : 'client',
    },
    { onConflict: 'id' },
  );

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
    return { info: 'If that email has an account, we sent a reset link.' };
  }

  const hdrs = await headers();
  const ip = extractIp(hdrs.get('x-forwarded-for'));
  const limited = await passwordResetLimiter.limit(`reset:${parsed.data.email.toLowerCase()}:${ip}`);
  if (!limited.success) {
    return { error: 'Too many reset requests. Try again later.' };
  }

  const supabase = await createSupabaseServerClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${env.NEXT_PUBLIC_APP_URL}/reset-password/confirm`,
  });
  return { info: 'If that email has an account, we sent a reset link.' };
}

const resetConfirmSchema = z.object({ password: z.string().min(8) });

export async function confirmPasswordResetAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = resetConfirmSchema.safeParse({ password: formData.get('password') });
  if (!parsed.success) {
    return { error: 'Password must be at least 8 characters.' };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: 'Could not update your password. Try requesting a new link.' };
  redirect('/login');
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/login');
}
