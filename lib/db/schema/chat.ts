import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { brands } from './brands';
import { users } from './users';

/**
 * One chat thread per brand. Brand members + staff (admin/operator) see it;
 * contractors do not — they communicate via deliverable comments (Phase 06).
 */
export const chatThreads = pgTable(
  'chat_threads',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true, mode: 'date' }),
  },
  (t) => ({
    brandUnique: uniqueIndex('chat_threads_brand_unique').on(t.brandId),
  }),
);

export const chatMessages = pgTable(
  'chat_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    threadId: uuid('thread_id')
      .notNull()
      .references(() => chatThreads.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'set null' }),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    editedAt: timestamp('edited_at', { withTimezone: true, mode: 'date' }),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
  },
  (t) => ({
    threadCreatedIdx: index('chat_messages_thread_created_idx').on(t.threadId, t.createdAt),
  }),
);

export const chatParticipants = pgTable(
  'chat_participants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    threadId: uuid('thread_id')
      .notNull()
      .references(() => chatThreads.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    lastReadAt: timestamp('last_read_at', { withTimezone: true, mode: 'date' }),
  },
  (t) => ({
    threadUserUnique: uniqueIndex('chat_participants_thread_user_unique').on(
      t.threadId,
      t.userId,
    ),
  }),
);
