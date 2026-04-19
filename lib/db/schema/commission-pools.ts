import {
  pgTable,
  pgEnum,
  uuid,
  integer,
  char,
  text,
  timestamp,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { brands } from './brands';
import { users } from './users';

export const commissionPoolScopeEnum = pgEnum('commission_pool_scope', [
  'monthly',
  'quarterly',
  'per_project',
]);

export const brandCommissionPools = pgTable(
  'brand_commission_pools',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id, { onDelete: 'cascade' }),
    poolBps: integer('pool_bps'),
    poolAmountCents: integer('pool_amount_cents'),
    currency: char('currency', { length: 3 }).notNull(),
    scope: commissionPoolScopeEnum('scope').notNull().default('monthly'),
    note: text('note'),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    brandUnique: uniqueIndex('brand_commission_pools_brand_unique').on(t.brandId),
    currencyIdx: index('brand_commission_pools_currency_idx').on(t.currency),
  }),
);

export const brandContractorAllocations = pgTable(
  'brand_contractor_allocations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id, { onDelete: 'cascade' }),
    contractorUserId: uuid('contractor_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    allocationBps: integer('allocation_bps').notNull(),
    currency: char('currency', { length: 3 }).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true, mode: 'date' }),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    activeUnique: uniqueIndex('brand_contractor_allocations_active_unique')
      .on(t.brandId, t.contractorUserId, t.currency)
      .where(sql`ended_at IS NULL`),
    contractorIdx: index('brand_contractor_allocations_contractor_idx').on(t.contractorUserId),
  }),
);
