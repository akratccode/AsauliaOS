import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  date,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { brands } from './brands';
import { users } from './users';
import { deliverableTypeEnum } from './enums';

export const deliverableRecurrenceFrequencyEnum = pgEnum(
  'deliverable_recurrence_frequency',
  ['daily', 'weekly', 'monthly'],
);

export const deliverableRecurrences = pgTable(
  'deliverable_recurrences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    type: deliverableTypeEnum('type').notNull().default('custom'),
    assigneeUserId: uuid('assignee_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    fixedShareBps: integer('fixed_share_bps').notNull().default(0),
    frequency: deliverableRecurrenceFrequencyEnum('frequency').notNull(),
    intervalCount: integer('interval_count').notNull().default(1),
    nextRunOn: date('next_run_on', { mode: 'string' }).notNull(),
    lastRunOn: date('last_run_on', { mode: 'string' }),
    active: boolean('active').notNull().default(true),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    brandActiveNextRunIdx: index('deliverable_recurrences_brand_active_next_run_idx').on(
      t.brandId,
      t.active,
      t.nextRunOn,
    ),
  }),
);
