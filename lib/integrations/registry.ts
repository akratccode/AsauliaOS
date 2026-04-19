import { manualAdapter } from './manual';
import { shopifyAdapter } from './shopify';
import { stripeSalesAdapter } from './stripe-sales';
import { woocommerceAdapter } from './woocommerce';
import type { IntegrationProvider, SalesAdapter } from './types';

const REGISTRY: Record<IntegrationProvider, SalesAdapter> = {
  shopify: shopifyAdapter,
  woocommerce: woocommerceAdapter,
  stripe: stripeSalesAdapter,
  manual: manualAdapter,
};

export function getAdapter(provider: IntegrationProvider): SalesAdapter {
  const adapter = REGISTRY[provider];
  if (!adapter) throw new Error(`Unknown integration provider: ${provider}`);
  return adapter;
}

export const KNOWN_PROVIDERS: IntegrationProvider[] = [
  'shopify',
  'woocommerce',
  'stripe',
  'manual',
];
