import {
  pgTable,
  uuid,
  integer,
  bigint,
  char,
  text,
  date,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { brands } from './brands';
import { users } from './users';
import {
  invoiceStatusEnum,
  payoutStatusEnum,
  ledgerKindEnum,
  billingJobStatusEnum,
  financeRegionEnum,
  financePeriodStatusEnum,
} from './enums';

export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id, { onDelete: 'cascade' }),
    periodStart: date('period_start', { mode: 'string' }).notNull(),
    periodEnd: date('period_end', { mode: 'string' }).notNull(),
    fixedAmountCents: integer('fixed_amount_cents').notNull(),
    variableAmountCents: integer('variable_amount_cents').notNull(),
    totalAmountCents: integer('total_amount_cents').generatedAlwaysAs(
      sql`fixed_amount_cents + variable_amount_cents`,
    ),
    currency: char('currency', { length: 3 }).notNull().default('USD'),
    financeRegion: financeRegionEnum('finance_region').notNull().default('us'),
    status: invoiceStatusEnum('status').notNull().default('draft'),
    stripeInvoiceId: text('stripe_invoice_id'),
    issuedAt: timestamp('issued_at', { withTimezone: true, mode: 'date' }),
    paidAt: timestamp('paid_at', { withTimezone: true, mode: 'date' }),
    planSnapshot: jsonb('plan_snapshot'),
    attributedSalesCents: bigint('attributed_sales_cents', { mode: 'number' }),
    retryCount: integer('retry_count').notNull().default(0),
    lastRetryAt: timestamp('last_retry_at', { withTimezone: true, mode: 'date' }),
    frozenAt: timestamp('frozen_at', { withTimezone: true, mode: 'date' }),
    pastDueSince: timestamp('past_due_since', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    brandPeriodUnique: uniqueIndex('invoices_brand_period_unique').on(t.brandId, t.periodStart),
    regionStatusPaidAtIdx: index('invoices_region_status_paid_at_idx').on(
      t.financeRegion,
      t.status,
      t.paidAt,
    ),
    brandPeriodEndIdx: index('invoices_brand_period_end_idx').on(t.brandId, t.periodEnd),
  }),
);

export const payouts = pgTable(
  'payouts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    contractorUserId: uuid('contractor_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    periodStart: date('period_start', { mode: 'string' }).notNull(),
    periodEnd: date('period_end', { mode: 'string' }).notNull(),
    amountCents: integer('amount_cents').notNull(),
    currency: char('currency', { length: 3 }).notNull().default('USD'),
    financeRegion: financeRegionEnum('finance_region').notNull().default('us'),
    status: payoutStatusEnum('status').notNull().default('pending'),
    stripeTransferId: text('stripe_transfer_id'),
    breakdown: jsonb('breakdown'),
    paidAt: timestamp('paid_at', { withTimezone: true, mode: 'date' }),
    failureReason: text('failure_reason'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    contractorPeriodUnique: uniqueIndex('payouts_contractor_period_unique').on(
      t.contractorUserId,
      t.periodStart,
    ),
    regionStatusPaidAtIdx: index('payouts_region_status_paid_at_idx').on(
      t.financeRegion,
      t.status,
      t.paidAt,
    ),
    contractorPeriodEndIdx: index('payouts_contractor_period_end_idx').on(
      t.contractorUserId,
      t.periodEnd,
    ),
  }),
);

export const billingJobs = pgTable(
  'billing_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(), // 'close_cycle' | 'run_payout' | 'dunning'
    periodStart: date('period_start', { mode: 'string' }).notNull(),
    periodEnd: date('period_end', { mode: 'string' }).notNull(),
    status: billingJobStatusEnum('status').notNull().default('running'),
    attempt: integer('attempt').notNull().default(1),
    lastError: text('last_error'),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
  },
  (t) => ({
    brandKindPeriodUnique: uniqueIndex('billing_jobs_brand_kind_period_unique').on(
      t.brandId,
      t.kind,
      t.periodStart,
    ),
  }),
);

export const ledgerEntries = pgTable(
  'ledger_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    occurredAt: timestamp('occurred_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    kind: ledgerKindEnum('kind').notNull(),
    amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
    currency: char('currency', { length: 3 }).notNull().default('USD'),
    financeRegion: financeRegionEnum('finance_region').notNull().default('us'),
    brandId: uuid('brand_id').references(() => brands.id, { onDelete: 'set null' }),
    contractorUserId: uuid('contractor_user_id').references(() => users.id, { onDelete: 'set null' }),
    invoiceId: uuid('invoice_id').references(() => invoices.id, { onDelete: 'set null' }),
    payoutId: uuid('payout_id').references(() => payouts.id, { onDelete: 'set null' }),
    description: text('description'),
    stripeEventId: text('stripe_event_id'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    stripeEventUnique: uniqueIndex('ledger_entries_stripe_event_unique').on(t.stripeEventId),
    occurredAtIdx: index('ledger_entries_occurred_at_idx').on(t.occurredAt),
    regionCreatedAtIdx: index('ledger_entries_region_created_at_idx').on(
      t.financeRegion,
      t.createdAt,
    ),
  }),
);

export const financePeriods = pgTable(
  'finance_periods',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    financeRegion: financeRegionEnum('finance_region').notNull(),
    currency: char('currency', { length: 3 }).notNull(),
    year: integer('year').notNull(),
    month: integer('month').notNull(),
    status: financePeriodStatusEnum('status').notNull().default('open'),
    revenueCents: bigint('revenue_cents', { mode: 'number' }).notNull().default(0),
    payoutsCents: bigint('payouts_cents', { mode: 'number' }).notNull().default(0),
    bonusesCents: bigint('bonuses_cents', { mode: 'number' }).notNull().default(0),
    netCents: bigint('net_cents', { mode: 'number' }).notNull().default(0),
    closedAt: timestamp('closed_at', { withTimezone: true, mode: 'date' }),
    closedByUserId: uuid('closed_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    regionYearMonthUnique: uniqueIndex('finance_periods_region_year_month_unique').on(
      t.financeRegion,
      t.year,
      t.month,
    ),
  }),
);
