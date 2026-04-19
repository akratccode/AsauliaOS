import {
  pgTable,
  uuid,
  text,
  integer,
  char,
  timestamp,
  boolean,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { brands } from './brands';
import { salesIntegrations } from './integrations';

export const salesRecords = pgTable(
  'sales_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id, { onDelete: 'cascade' }),
    integrationId: uuid('integration_id')
      .notNull()
      .references(() => salesIntegrations.id, { onDelete: 'cascade' }),
    externalId: text('external_id').notNull(),
    amountCents: integer('amount_cents').notNull(),
    currency: char('currency', { length: 3 }).notNull().default('USD'),
    occurredAt: timestamp('occurred_at', { withTimezone: true, mode: 'date' }).notNull(),
    attributed: boolean('attributed').notNull().default(false),
    attributionReason: text('attribution_reason'),
    rawPayload: jsonb('raw_payload'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    integrationExternalUnique: uniqueIndex('sales_records_integration_external_unique').on(
      t.integrationId,
      t.externalId,
    ),
    brandOccurredIdx: index('sales_records_brand_occurred_idx').on(t.brandId, t.occurredAt),
    brandAttributedIdx: index('sales_records_brand_attributed_idx').on(
      t.brandId,
      t.attributed,
      t.occurredAt,
    ),
  }),
);
