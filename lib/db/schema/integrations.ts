import { pgTable, uuid, text, timestamp, jsonb, customType } from 'drizzle-orm/pg-core';
import { brands } from './brands';
import { integrationProviderEnum, integrationStatusEnum } from './enums';

const bytea = customType<{ data: Buffer; notNull: false; default: false }>({
  dataType() {
    return 'bytea';
  },
});

export const salesIntegrations = pgTable('sales_integrations', {
  id: uuid('id').primaryKey().defaultRandom(),
  brandId: uuid('brand_id')
    .notNull()
    .references(() => brands.id, { onDelete: 'cascade' }),
  provider: integrationProviderEnum('provider').notNull(),
  status: integrationStatusEnum('status').notNull().default('connecting'),
  displayName: text('display_name').notNull(),
  externalAccountId: text('external_account_id'),
  configEncrypted: bytea('config_encrypted'),
  attributionRules: jsonb('attribution_rules'),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true, mode: 'date' }),
  lastError: text('last_error'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
});
