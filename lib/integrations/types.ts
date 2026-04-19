export type IntegrationProvider = 'shopify' | 'woocommerce' | 'stripe' | 'manual';

export type NormalizedSale = {
  externalId: string;
  amountCents: number;
  currency: string;
  occurredAt: Date;
  metadata: Record<string, unknown>;
};

export type AttributionRule =
  | { type: 'all' }
  | { type: 'utm_source'; values: string[] }
  | { type: 'utm_medium'; values: string[] }
  | { type: 'utm_campaign_prefix'; prefix: string }
  | { type: 'coupon'; codes: string[] }
  | { type: 'landing_page_prefix'; prefix: string };

export type ConnectInput = { brandId: string; payload: unknown };

export type ConnectResult = {
  externalAccountId: string;
  displayName: string;
  config: unknown;
};

export interface SalesAdapter {
  provider: IntegrationProvider;
  connect(input: ConnectInput): Promise<ConnectResult>;
  pullSince(ctx: { config: unknown; since: Date }): Promise<NormalizedSale[]>;
  handleWebhook?(ctx: {
    config: unknown;
    headers: Headers;
    body: string;
  }): Promise<NormalizedSale[]>;
  disconnect(ctx: { config: unknown }): Promise<void>;
}
