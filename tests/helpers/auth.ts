import type { AuthContext, BrandRole, GlobalRole } from '@/lib/auth/rbac';
import { __setAuthResolversForTests, __resetAuthResolvers } from '@/lib/auth/rbac';

type SessionSpec = Partial<AuthContext> & { globalRole: GlobalRole };

export function mockSession(session: SessionSpec | null, opts?: { brandRoles?: Record<string, BrandRole | null> }) {
  __setAuthResolversForTests({
    auth: async () =>
      session
        ? {
            userId: session.userId ?? '00000000-0000-0000-0000-000000000001',
            email: session.email ?? 'test@asaulia.test',
            globalRole: session.globalRole,
          }
        : null,
    brandRole: async (_userId, brandId) => opts?.brandRoles?.[brandId] ?? null,
  });
}

export function resetSession() {
  __resetAuthResolvers();
}
