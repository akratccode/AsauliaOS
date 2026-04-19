import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';

type Role = 'client' | 'contractor' | 'admin';
const ROLES = ['client', 'contractor', 'admin'] as const;

function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const role = process.argv[3]?.trim().toLowerCase();

  if (!email || !role || !isRole(role)) {
    console.error('Usage: pnpm tsx scripts/set-role.ts <email> <client|contractor|admin>');
    process.exit(1);
  }

  const [user] = await db
    .select({ id: schema.users.id, currentRole: schema.users.globalRole })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);

  if (!user) {
    console.error(`No user found with email "${email}". Sign up first.`);
    process.exit(1);
  }

  await db
    .update(schema.users)
    .set({ globalRole: role, updatedAt: new Date() })
    .where(eq(schema.users.id, user.id));

  if (role === 'contractor') {
    await db
      .insert(schema.contractorProfiles)
      .values({
        userId: user.id,
        headline: 'Test contractor',
        skills: ['test'],
        status: 'active',
        payoutOnboardingComplete: true,
      })
      .onConflictDoUpdate({
        target: schema.contractorProfiles.userId,
        set: {
          status: 'active',
          payoutOnboardingComplete: true,
          updatedAt: new Date(),
        },
      });
  }

  const memberships = await db
    .select({ brandId: schema.brandMembers.brandId })
    .from(schema.brandMembers)
    .where(eq(schema.brandMembers.userId, user.id));

  console.log(`${email}: ${user.currentRole} → ${role}`);
  if (role === 'client' && memberships.length === 0) {
    console.log('  ⚠  no brand memberships found — complete /onboarding/brand to access /dashboard.');
  }
  if (role === 'contractor') {
    console.log('  → contractor_profile active. Visit /tasks.');
  }
  if (role === 'admin') {
    console.log('  → visit /admin/brands. Admin sees every brand in the switcher.');
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
