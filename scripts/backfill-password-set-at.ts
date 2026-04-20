import { isNull, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';

async function main() {
  const rows = await db
    .update(schema.users)
    .set({ passwordSetAt: sql`created_at` })
    .where(isNull(schema.users.passwordSetAt))
    .returning({ id: schema.users.id });
  console.log(`backfilled password_set_at for ${rows.length} users`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
