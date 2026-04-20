'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth/rbac';
import { inviteUserByEmail } from '@/lib/auth/invite';

const InviteContractorSchema = z.object({
  email: z.string().email(),
  fullName: z.string().trim().min(1).max(120).optional(),
});

export type AdminInviteContractorErrorCode =
  | 'invalid_input'
  | 'role_conflict'
  | 'invite_failed'
  | 'generic';
export type AdminInviteContractorInfoCode = 'invited' | 'linked';
export type AdminInviteContractorActionResult =
  | { ok: true; info: AdminInviteContractorInfoCode }
  | { ok: false; error: AdminInviteContractorErrorCode };

export async function adminInviteContractorAction(
  _prev: AdminInviteContractorActionResult | undefined,
  formData: FormData,
): Promise<AdminInviteContractorActionResult> {
  try {
    const admin = await requireAdmin();
    const parsed = InviteContractorSchema.safeParse({
      email: String(formData.get('email') ?? '').toLowerCase(),
      fullName: formData.get('fullName') ? String(formData.get('fullName')) : undefined,
    });
    if (!parsed.success) return { ok: false, error: 'invalid_input' };

    const result = await inviteUserByEmail({
      kind: 'contractor',
      email: parsed.data.email,
      fullName: parsed.data.fullName ?? null,
      invitedByUserId: admin.userId,
    });
    if (!result.ok) {
      if (result.error === 'role_conflict') return { ok: false, error: 'role_conflict' };
      return { ok: false, error: 'invite_failed' };
    }

    revalidatePath('/admin/contractors');
    return { ok: true, info: result.reused ? 'linked' : 'invited' };
  } catch {
    return { ok: false, error: 'generic' };
  }
}
