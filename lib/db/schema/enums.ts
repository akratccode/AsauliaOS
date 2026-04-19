import { pgEnum } from 'drizzle-orm/pg-core';

export const globalRoleEnum = pgEnum('global_role', [
  'admin',
  'operator',
  'contractor',
  'client',
]);

export const brandStatusEnum = pgEnum('brand_status', [
  'trial',
  'active',
  'past_due',
  'paused',
  'cancelled',
]);

export const brandMemberRoleEnum = pgEnum('brand_member_role', ['owner', 'member']);

export const contractorStatusEnum = pgEnum('contractor_status', [
  'pending',
  'active',
  'paused',
]);

export const deliverableTypeEnum = pgEnum('deliverable_type', [
  'content_post',
  'ad_creative',
  'landing_page',
  'seo_article',
  'email_sequence',
  'strategy_doc',
  'custom',
]);

export const deliverableStatusEnum = pgEnum('deliverable_status', [
  'todo',
  'in_progress',
  'in_review',
  'done',
  'rejected',
]);

export const integrationProviderEnum = pgEnum('integration_provider', [
  'shopify',
  'woocommerce',
  'stripe',
  'manual',
]);

export const integrationStatusEnum = pgEnum('integration_status', [
  'connecting',
  'active',
  'error',
  'disabled',
]);

export const invoiceStatusEnum = pgEnum('invoice_status', [
  'draft',
  'open',
  'paid',
  'failed',
  'void',
]);

export const payoutStatusEnum = pgEnum('payout_status', [
  'pending',
  'processing',
  'paid',
  'failed',
]);
