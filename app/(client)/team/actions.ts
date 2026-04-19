'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/rbac';
import { db, schema } from '@/lib/db';
import { resolveActiveBrand, requireClientBrandAccess } from '@/lib/brand/context';
import { createInvitation } from '@/lib/auth/admin-ops';

export type TeamErrorCode =
  | 'no_active_brand'
  | 'only_owner_can_invite'
  | 'valid_email_and_role'
  | 'only_owner_can_revoke'
  | 'invalid_request';

export type TeamInfoCode = 'invitation_sent' | 'invitation_revoked';

export type TeamActionState =
  | { error: TeamErrorCode }
  | { info: 'invitation_sent'; email: string }
  | { info: 'invitation_revoked' }
  | undefined;

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['owner', 'member']),
});

export async function inviteTeamMemberAction(
  _prev: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const actor = await requireAuth();
  const { active } = await resolveActiveBrand(actor);
  if (!active) return { error: 'no_active_brand' };
  const { role } = await requireClientBrandAccess(actor, active.id);
  if (role !== 'owner' && actor.globalRole !== 'admin' && actor.globalRole !== 'operator') {
    return { error: 'only_owner_can_invite' };
  }

  const parsed = inviteSchema.safeParse({
    email: formData.get('email'),
    role: formData.get('role'),
  });
  if (!parsed.success) return { error: 'valid_email_and_role' };

  await createInvitation({
    scope: 'brand',
    role: parsed.data.role,
    email: parsed.data.email,
    brandId: active.id,
    invitedByUserId: actor.userId,
  });

  revalidatePath('/team');
  return { info: 'invitation_sent', email: parsed.data.email };
}

const revokeSchema = z.object({ invitationId: z.string().uuid() });

export async function revokeInvitationAction(
  _prev: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const actor = await requireAuth();
  const { active } = await resolveActiveBrand(actor);
  if (!active) return { error: 'no_active_brand' };
  const { role } = await requireClientBrandAccess(actor, active.id);
  if (role !== 'owner' && actor.globalRole !== 'admin' && actor.globalRole !== 'operator') {
    return { error: 'only_owner_can_revoke' };
  }

  const parsed = revokeSchema.safeParse({ invitationId: formData.get('invitationId') });
  if (!parsed.success) return { error: 'invalid_request' };

  await db
    .delete(schema.invitations)
    .where(
      and(
        eq(schema.invitations.id, parsed.data.invitationId),
        eq(schema.invitations.brandId, active.id),
      ),
    );

  revalidatePath('/team');
  return { info: 'invitation_revoked' };
}
