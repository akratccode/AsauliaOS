import { afterEach, describe, expect, it } from 'vitest';
import { requireAuth, requireAdmin, requireBrandAccess, requireRole } from '@/lib/auth/rbac';
import { Forbidden, Unauthorized } from '@/lib/auth/errors';
import { mockSession, resetSession } from '../helpers/auth';

const BRAND_A = '11111111-1111-1111-1111-111111111111';
const BRAND_B = '22222222-2222-2222-2222-222222222222';

describe('rbac', () => {
  afterEach(() => {
    resetSession();
  });

  it('requireAuth throws Unauthorized when no session', async () => {
    mockSession(null);
    await expect(requireAuth()).rejects.toBeInstanceOf(Unauthorized);
  });

  it('requireRole passes when the user has the allowed role', async () => {
    mockSession({ globalRole: 'admin' });
    await expect(requireRole(['admin'])).resolves.toMatchObject({ globalRole: 'admin' });
  });

  it('requireRole throws Forbidden for a client session', async () => {
    mockSession({ globalRole: 'client' });
    await expect(requireRole(['admin'])).rejects.toBeInstanceOf(Forbidden);
  });

  it('requireAdmin throws for operator', async () => {
    mockSession({ globalRole: 'operator' });
    await expect(requireAdmin()).rejects.toBeInstanceOf(Forbidden);
  });

  it('requireBrandAccess passes for brand members', async () => {
    mockSession({ globalRole: 'client' }, { brandRoles: { [BRAND_A]: 'owner' } });
    const ctx = await requireBrandAccess(BRAND_A);
    expect(ctx.brandRole).toBe('owner');
  });

  it('requireBrandAccess throws Forbidden for non-members', async () => {
    mockSession({ globalRole: 'client' }, { brandRoles: { [BRAND_A]: null } });
    await expect(requireBrandAccess(BRAND_A)).rejects.toBeInstanceOf(Forbidden);
  });

  it('requireBrandAccess lets admins into any brand without membership', async () => {
    mockSession({ globalRole: 'admin' });
    const ctx = await requireBrandAccess(BRAND_B);
    expect(ctx.brandRole).toBeNull();
  });

  it('requireBrandAccess restricts by brand role', async () => {
    mockSession({ globalRole: 'client' }, { brandRoles: { [BRAND_A]: 'member' } });
    await expect(requireBrandAccess(BRAND_A, ['owner'])).rejects.toBeInstanceOf(Forbidden);
  });
});
