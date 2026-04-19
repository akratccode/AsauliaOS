'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/rbac';
import { db, schema } from '@/lib/db';

export type ProfileActionState = { error?: string; info?: string } | undefined;

const skillsSchema = z
  .string()
  .optional()
  .transform((value) =>
    (value ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .slice(0, 20),
  );

const inputSchema = z.object({
  headline: z.string().max(120).optional().transform((v) => (v ? v : null)),
  skills: skillsSchema,
  timezone: z.string().min(1).max(64),
});

export async function updateContractorProfileAction(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const actor = await requireAuth();

  const parsed = inputSchema.safeParse({
    headline: formData.get('headline') ?? '',
    skills: formData.get('skills') ?? '',
    timezone: formData.get('timezone') ?? 'UTC',
  });
  if (!parsed.success) return { error: 'Check the fields and try again.' };

  const existing = await db
    .select({ userId: schema.contractorProfiles.userId })
    .from(schema.contractorProfiles)
    .where(eq(schema.contractorProfiles.userId, actor.userId))
    .limit(1);

  if (existing[0]) {
    await db
      .update(schema.contractorProfiles)
      .set({
        headline: parsed.data.headline,
        skills: parsed.data.skills,
        updatedAt: new Date(),
      })
      .where(eq(schema.contractorProfiles.userId, actor.userId));
  } else {
    await db.insert(schema.contractorProfiles).values({
      userId: actor.userId,
      headline: parsed.data.headline,
      skills: parsed.data.skills,
    });
  }

  await db
    .update(schema.users)
    .set({ timezone: parsed.data.timezone, updatedAt: new Date() })
    .where(eq(schema.users.id, actor.userId));

  revalidatePath('/profile');
  revalidatePath('/onboarding');
  return { info: 'Profile saved.' };
}
