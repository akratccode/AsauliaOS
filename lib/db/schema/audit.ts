import { pgTable, uuid, text, timestamp, jsonb, inet, index } from 'drizzle-orm/pg-core';
import { users } from './users';
import { brands } from './brands';

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    brandId: uuid('brand_id').references(() => brands.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    entityType: text('entity_type'),
    entityId: uuid('entity_id'),
    before: jsonb('before'),
    after: jsonb('after'),
    ipAddress: inet('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    actorCreatedIdx: index('audit_log_actor_created_idx').on(t.actorUserId, t.createdAt),
    brandCreatedIdx: index('audit_log_brand_created_idx').on(t.brandId, t.createdAt),
  }),
);
