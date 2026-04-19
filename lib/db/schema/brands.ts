import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { brandMemberRoleEnum, brandStatusEnum } from './enums';

export const brands = pgTable('brands', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  logoUrl: text('logo_url'),
  website: text('website'),
  ownerUserId: uuid('owner_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  status: brandStatusEnum('status').notNull().default('trial'),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  timezone: text('timezone').notNull().default('UTC'),
  billingCycleDay: integer('billing_cycle_day'),
  deliverablesFrozen: boolean('deliverables_frozen').notNull().default(false),
  pastDueSince: timestamp('past_due_since', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true, mode: 'date' }),
});

export const brandMembers = pgTable(
  'brand_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: brandMemberRoleEnum('role').notNull().default('member'),
    invitedAt: timestamp('invited_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true, mode: 'date' }),
  },
  (t) => ({
    brandUserUnique: uniqueIndex('brand_members_brand_user_unique').on(t.brandId, t.userId),
  }),
);
