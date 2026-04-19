import 'server-only';
import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { auditLog, invitations, users } from '@/lib/db/schema';
import type { GlobalRole } from './rbac';

export function generateInviteToken(): string {
  return randomBytes(24).toString('base64url');
}

type InviteInput =
  | {
      scope: 'global';
      role: Extract<GlobalRole, 'admin' | 'operator' | 'contractor'>;
      email: string;
      invitedByUserId: string;
    }
  | {
      scope: 'brand';
      role: 'owner' | 'member';
      email: string;
      brandId: string;
      invitedByUserId: string;
    };

export async function createInvitation(input: InviteInput) {
  const token = generateInviteToken();
  const [row] = await db
    .insert(invitations)
    .values({
      email: input.email,
      token,
      scope: input.scope,
      role: input.role,
      brandId: input.scope === 'brand' ? input.brandId : null,
      invitedByUserId: input.invitedByUserId,
    })
    .returning();

  if (!row) throw new Error('Failed to create invitation');

  await db.insert(auditLog).values({
    actorUserId: input.invitedByUserId,
    brandId: input.scope === 'brand' ? input.brandId : null,
    action: 'invitation.created',
    entityType: 'invitation',
    entityId: row.id,
    after: { email: input.email, scope: input.scope, role: input.role },
  });

  return row;
}

export async function updateUserGlobalRole(params: {
  actorUserId: string;
  targetUserId: string;
  nextRole: GlobalRole;
  reason?: string;
}) {
  const [before] = await db
    .select({ role: users.globalRole })
    .from(users)
    .where(eq(users.id, params.targetUserId))
    .limit(1);

  await db
    .update(users)
    .set({ globalRole: params.nextRole, updatedAt: new Date() })
    .where(eq(users.id, params.targetUserId));

  await db.insert(auditLog).values({
    actorUserId: params.actorUserId,
    action: 'user.role_changed',
    entityType: 'user',
    entityId: params.targetUserId,
    before: before ? { role: before.role } : null,
    after: { role: params.nextRole, reason: params.reason ?? null },
  });
}
