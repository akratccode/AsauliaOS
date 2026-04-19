import {
  pgTable,
  uuid,
  text,
  date,
  integer,
  bigint,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { brands } from './brands';
import { users } from './users';
import { deliverableStatusEnum, deliverableTypeEnum } from './enums';

export const deliverables = pgTable(
  'deliverables',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id, { onDelete: 'cascade' }),
    periodStart: date('period_start', { mode: 'string' }).notNull(),
    periodEnd: date('period_end', { mode: 'string' }).notNull(),
    title: text('title').notNull(),
    description: text('description'),
    type: deliverableTypeEnum('type').notNull().default('custom'),
    status: deliverableStatusEnum('status').notNull().default('todo'),
    assigneeUserId: uuid('assignee_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    dueDate: date('due_date', { mode: 'string' }),
    fixedShareBps: integer('fixed_share_bps').notNull().default(0),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    brandPeriodStatusIdx: index('deliverables_brand_period_status_idx').on(
      t.brandId,
      t.periodStart,
      t.status,
    ),
    assigneeStatusActiveIdx: index('deliverables_assignee_status_active_idx')
      .on(t.assigneeUserId, t.status)
      .where(sql`archived_at IS NULL`),
  }),
);

export const deliverableCommentMentions = pgTable('deliverable_comment_mentions', {
  id: uuid('id').primaryKey().defaultRandom(),
  commentId: uuid('comment_id')
    .notNull()
    .references(() => deliverableComments.id, { onDelete: 'cascade' }),
  mentionedUserId: uuid('mentioned_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

export const deliverableAttachments = pgTable('deliverable_attachments', {
  id: uuid('id').primaryKey().defaultRandom(),
  deliverableId: uuid('deliverable_id')
    .notNull()
    .references(() => deliverables.id, { onDelete: 'cascade' }),
  filePath: text('file_path').notNull(),
  fileName: text('file_name').notNull(),
  mimeType: text('mime_type'),
  sizeBytes: bigint('size_bytes', { mode: 'number' }),
  uploadedByUserId: uuid('uploaded_by_user_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

export const deliverableComments = pgTable('deliverable_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  deliverableId: uuid('deliverable_id')
    .notNull()
    .references(() => deliverables.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

export const deliverableActivity = pgTable('deliverable_activity', {
  id: uuid('id').primaryKey().defaultRandom(),
  deliverableId: uuid('deliverable_id')
    .notNull()
    .references(() => deliverables.id, { onDelete: 'cascade' }),
  actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  payload: jsonb('payload'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});
