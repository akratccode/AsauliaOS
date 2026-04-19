import { pgTable, uuid, integer, text, timestamp, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { brands } from './brands';
import { users } from './users';

export const plans = pgTable(
  'plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id, { onDelete: 'cascade' }),
    fixedAmountCents: integer('fixed_amount_cents').notNull(),
    variablePercentBps: integer('variable_percent_bps').notNull(),
    effectiveFrom: timestamp('effective_from', { withTimezone: true, mode: 'date' }).notNull(),
    effectiveTo: timestamp('effective_to', { withTimezone: true, mode: 'date' }),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    brandEffectiveIdx: index('plans_brand_effective_idx').on(t.brandId, t.effectiveFrom),
    fixedRange: check(
      'plans_fixed_amount_range',
      sql`${t.fixedAmountCents} >= 9900 AND ${t.fixedAmountCents} <= 100000`,
    ),
    variableRange: check(
      'plans_variable_percent_range',
      sql`${t.variablePercentBps} >= 700 AND ${t.variablePercentBps} <= 2000`,
    ),
  }),
);
