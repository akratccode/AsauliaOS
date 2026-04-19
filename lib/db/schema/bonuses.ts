import {
  pgTable,
  pgEnum,
  uuid,
  integer,
  char,
  text,
  date,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { brands } from './brands';
import { users } from './users';
import { financeRegionEnum } from './enums';

export const contractorBonusConditionEnum = pgEnum('contractor_bonus_condition', [
  'all_deliverables_done',
  'min_deliverables_done',
  'manual',
]);

export const contractorBonusStatusEnum = pgEnum('contractor_bonus_status', [
  'pending',
  'earned',
  'forfeited',
  'paid',
]);

export const contractorBonuses = pgTable(
  'contractor_bonuses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    contractorUserId: uuid('contractor_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    brandId: uuid('brand_id').references(() => brands.id, { onDelete: 'set null' }),
    periodStart: date('period_start', { mode: 'string' }).notNull(),
    periodEnd: date('period_end', { mode: 'string' }).notNull(),
    amountCents: integer('amount_cents').notNull(),
    currency: char('currency', { length: 3 }).notNull().default('USD'),
    financeRegion: financeRegionEnum('finance_region').notNull().default('us'),
    conditionType: contractorBonusConditionEnum('condition_type')
      .notNull()
      .default('manual'),
    conditionMinCount: integer('condition_min_count'),
    status: contractorBonusStatusEnum('status').notNull().default('pending'),
    note: text('note'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true, mode: 'date' }),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    contractorPeriodIdx: index('contractor_bonuses_contractor_period_idx').on(
      t.contractorUserId,
      t.periodStart,
    ),
    statusIdx: index('contractor_bonuses_status_idx').on(t.status),
    contractorStatusResolvedIdx: index('contractor_bonuses_contractor_status_resolved_idx').on(
      t.contractorUserId,
      t.status,
      t.resolvedAt,
    ),
  }),
);
