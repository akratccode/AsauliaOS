import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error('Usage: pnpm tsx scripts/grant-test-access.ts <email>');
    process.exit(1);
  }

  const [user] = await db
    .select({ id: schema.users.id, globalRole: schema.users.globalRole })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);

  if (!user) {
    console.error(`No user found with email "${email}".`);
    console.error('Sign up first, or pass an email that exists in public.users.');
    process.exit(1);
  }

  await db
    .update(schema.users)
    .set({ globalRole: 'admin', updatedAt: new Date() })
    .where(eq(schema.users.id, user.id));

  await db
    .insert(schema.contractorProfiles)
    .values({
      userId: user.id,
      headline: 'Test access (admin)',
      skills: ['test'],
      status: 'active',
      payoutOnboardingComplete: true,
    })
    .onConflictDoUpdate({
      target: schema.contractorProfiles.userId,
      set: { status: 'active', payoutOnboardingComplete: true, updatedAt: new Date() },
    });

  console.log(`Granted test access to ${email}:`);
  console.log('  - global_role = admin  → /admin/*, /dashboard, /tasks, /earnings, etc.');
  console.log('  - contractor_profile upserted (active, onboarding complete)');
  console.log('Admins see every seeded brand via the brand switcher.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
