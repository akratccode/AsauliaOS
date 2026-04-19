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
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { brands } from './brands';
import { users } from './users';
import { invoiceStatusEnum, payoutStatusEnum } from './enums';

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
    status: invoiceStatusEnum('status').notNull().default('draft'),
    stripeInvoiceId: text('stripe_invoice_id'),
    issuedAt: timestamp('issued_at', { withTimezone: true, mode: 'date' }),
    paidAt: timestamp('paid_at', { withTimezone: true, mode: 'date' }),
    planSnapshot: jsonb('plan_snapshot'),
    attributedSalesCents: bigint('attributed_sales_cents', { mode: 'number' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    brandPeriodUnique: uniqueIndex('invoices_brand_period_unique').on(t.brandId, t.periodStart),
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
    status: payoutStatusEnum('status').notNull().default('pending'),
    stripeTransferId: text('stripe_transfer_id'),
    breakdown: jsonb('breakdown'),
    paidAt: timestamp('paid_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    contractorPeriodUnique: uniqueIndex('payouts_contractor_period_unique').on(
      t.contractorUserId,
      t.periodStart,
    ),
  }),
);
