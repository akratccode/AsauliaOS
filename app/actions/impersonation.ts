'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { createSupabaseServerClient } from '@/lib/auth/supabase-server';
import {
  clearImpersonationCookie,
  readImpersonationCookie,
  writeImpersonationCookie,
} from '@/lib/auth/impersonation';
import { db, schema } from '@/lib/db';

async function loadRealAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const [profile] = await db
    .select({ id: schema.users.id, email: schema.users.email, globalRole: schema.users.globalRole })
    .from(schema.users)
    .where(eq(schema.users.id, data.user.id))
    .limit(1);
  return profile ?? null;
}

export async function startImpersonationAction(formData: FormData): Promise<void> {
  const admin = await loadRealAdmin();
  if (!admin) {
    redirect('/login');
  }
  if (admin.globalRole !== 'admin') {
    redirect('/admin/contractors?impersonate_error=forbidden');
  }

  const targetUserId = String(formData.get('targetUserId') ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(targetUserId) || targetUserId === admin.id) {
    redirect('/admin/contractors?impersonate_error=invalid_target');
  }

  const [target] = await db
    .select({ id: schema.users.id, email: schema.users.email })
    .from(schema.users)
    .where(eq(schema.users.id, targetUserId))
    .limit(1);
  if (!target) {
    redirect('/admin/contractors?impersonate_error=not_found');
  }

  await writeImpersonationCookie({ adminUserId: admin.id, targetUserId });

  await db.insert(schema.auditLog).values({
    actorUserId: admin.id,
    action: 'impersonation.started',
    entityType: 'user',
    entityId: target.id,
    after: { targetEmail: target.email },
  });

  redirect('/dashboard');
}

export async function stopImpersonationAction(): Promise<void> {
  const existing = await readImpersonationCookie();
  await clearImpersonationCookie();
  if (existing) {
    await db.insert(schema.auditLog).values({
      actorUserId: existing.adminUserId,
      action: 'impersonation.stopped',
      entityType: 'user',
      entityId: existing.targetUserId,
    });
  }
  revalidatePath('/', 'layout');
  redirect('/admin/contractors');
}
