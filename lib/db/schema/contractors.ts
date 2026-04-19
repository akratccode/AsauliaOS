import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { brands } from './brands';
import { contractorStatusEnum } from './enums';

export const contractorProfiles = pgTable('contractor_profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  headline: text('headline'),
  skills: text('skills')
    .array()
    .notNull()
    .default(sql`ARRAY[]::text[]`),
  hourlyRateCents: integer('hourly_rate_cents'),
  stripeConnectAccountId: text('stripe_connect_account_id'),
  payoutOnboardingComplete: boolean('payout_onboarding_complete').notNull().default(false),
  status: contractorStatusEnum('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});

export const brandContractors = pgTable(
  'brand_contractors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id, { onDelete: 'cascade' }),
    contractorUserId: uuid('contractor_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true, mode: 'date' }),
  },
  (t) => ({
    assignmentUnique: uniqueIndex('brand_contractors_unique').on(
      t.brandId,
      t.contractorUserId,
      t.role,
    ),
  }),
);
