import 'server-only';
import { redirect } from 'next/navigation';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users, brandMembers } from '@/lib/db/schema';
import { createSupabaseServerClient } from './supabase-server';
import { Forbidden, Unauthorized } from './errors';

export type GlobalRole = 'admin' | 'operator' | 'contractor' | 'client';
export type BrandRole = 'owner' | 'member';

export type AuthContext = {
  userId: string;
  email: string;
  globalRole: GlobalRole;
};

export type BrandContext = AuthContext & {
  brandId: string;
  brandRole: BrandRole | null;
};

export type AuthResolver = () => Promise<AuthContext | null>;
export type BrandRoleResolver = (userId: string, brandId: string) => Promise<BrandRole | null>;

async function defaultAuthResolver(): Promise<AuthContext | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;

  const row = await db
    .select({ id: users.id, email: users.email, globalRole: users.globalRole })
    .from(users)
    .where(eq(users.id, data.user.id))
    .limit(1);

  const profile = row[0];
  if (!profile) return null;
  return { userId: profile.id, email: profile.email, globalRole: profile.globalRole };
}

async function defaultBrandRoleResolver(
  userId: string,
  brandId: string,
): Promise<BrandRole | null> {
  const row = await db
    .select({ role: brandMembers.role })
    .from(brandMembers)
    .where(and(eq(brandMembers.userId, userId), eq(brandMembers.brandId, brandId)))
    .limit(1);
  return row[0]?.role ?? null;
}

let authResolver: AuthResolver = defaultAuthResolver;
let brandRoleResolver: BrandRoleResolver = defaultBrandRoleResolver;

export function __setAuthResolversForTests(opts: {
  auth?: AuthResolver;
  brandRole?: BrandRoleResolver;
}) {
  if (opts.auth) authResolver = opts.auth;
  if (opts.brandRole) brandRoleResolver = opts.brandRole;
}

export function __resetAuthResolvers() {
  authResolver = defaultAuthResolver;
  brandRoleResolver = defaultBrandRoleResolver;
}

export async function requireAuth(): Promise<AuthContext> {
  const ctx = await authResolver();
  if (!ctx) {
    if (authResolver !== defaultAuthResolver) {
      throw new Unauthorized();
    }
    redirect('/login');
  }
  return ctx;
}

export async function requireRole(roles: GlobalRole[]): Promise<AuthContext> {
  const ctx = await requireAuth();
  if (!roles.includes(ctx.globalRole)) {
    throw new Forbidden(`Requires one of: ${roles.join(', ')}`);
  }
  return ctx;
}

export async function requireAdmin(): Promise<AuthContext> {
  return requireRole(['admin']);
}

export async function requireBrandAccess(
  brandId: string,
  allowedBrandRoles?: BrandRole[],
): Promise<BrandContext> {
  const ctx = await requireAuth();

  if (ctx.globalRole === 'admin' || ctx.globalRole === 'operator') {
    return { ...ctx, brandId, brandRole: null };
  }

  const brandRole = await brandRoleResolver(ctx.userId, brandId);
  if (!brandRole) {
    throw new Forbidden('Not a member of this brand');
  }
  if (allowedBrandRoles && !allowedBrandRoles.includes(brandRole)) {
    throw new Forbidden(`Brand role must be one of: ${allowedBrandRoles.join(', ')}`);
  }
  return { ...ctx, brandId, brandRole };
}
