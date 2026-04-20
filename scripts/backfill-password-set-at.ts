import { isNull, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { getSupabaseAdminClient } from '@/lib/auth/supabase-admin';

async function main() {
  const dbRows = await db
    .update(schema.users)
    .set({ passwordSetAt: sql`created_at` })
    .where(isNull(schema.users.passwordSetAt))
    .returning({ id: schema.users.id });
  console.log(`backfilled password_set_at in public.users for ${dbRows.length} rows`);

  const allUsers = await db
    .select({ id: schema.users.id, createdAt: schema.users.createdAt })
    .from(schema.users);

  const admin = getSupabaseAdminClient();
  let stamped = 0;
  let skipped = 0;
  for (const u of allUsers) {
    const { data, error } = await admin.auth.admin.getUserById(u.id);
    if (error || !data.user) {
      skipped += 1;
      continue;
    }
    if (data.user.user_metadata?.password_set_at) {
      skipped += 1;
      continue;
    }
    const iso = (u.createdAt ?? new Date()).toISOString();
    const { error: updErr } = await admin.auth.admin.updateUserById(u.id, {
      user_metadata: { ...data.user.user_metadata, password_set_at: iso },
    });
    if (updErr) {
      console.error(`failed to stamp ${u.id}: ${updErr.message}`);
      skipped += 1;
    } else {
      stamped += 1;
    }
  }
  console.log(
    `stamped user_metadata.password_set_at on ${stamped} Supabase auth users (${skipped} skipped)`,
  );

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
