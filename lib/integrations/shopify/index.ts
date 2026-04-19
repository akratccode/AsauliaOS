import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '@/lib/env';
import type { NormalizedSale, SalesAdapter } from '../types';

type ShopifyConfig = {
  shop: string; // e.g. "store.myshopify.com"
  accessToken: string;
};

type ShopifyOrder = {
  id: number;
  created_at: string;
  total_price: string;
  currency: string;
  note_attributes?: Array<{ name: string; value: string }>;
  discount_codes?: Array<{ code: string; amount?: string }>;
  landing_site?: string | null;
  referring_site?: string | null;
  source_name?: string | null;
};

function parseQueryParams(urlOrQueryString: string): Record<string, string> {
  if (!urlOrQueryString) return {};
  const qs = urlOrQueryString.includes('?')
    ? urlOrQueryString.slice(urlOrQueryString.indexOf('?') + 1)
    : urlOrQueryString;
  const params = new URLSearchParams(qs);
  const out: Record<string, string> = {};
  for (const [k, v] of params.entries()) out[k] = v;
  return out;
}

function mapOrder(order: ShopifyOrder): NormalizedSale {
  const noteAttrs = new Map(
    (order.note_attributes ?? []).map((a) => [a.name.toLowerCase(), a.value]),
  );
  const landingParams = parseQueryParams(order.landing_site ?? '');
  const utm_source = noteAttrs.get('utm_source') ?? landingParams.utm_source;
  const utm_medium = noteAttrs.get('utm_medium') ?? landingParams.utm_medium;
  const utm_campaign = noteAttrs.get('utm_campaign') ?? landingParams.utm_campaign;
  const coupon = order.discount_codes?.[0]?.code ?? null;
  return {
    externalId: String(order.id),
    amountCents: Math.round(Number(order.total_price) * 100),
    currency: order.currency,
    occurredAt: new Date(order.created_at),
    metadata: {
      utm_source: utm_source ?? null,
      utm_medium: utm_medium ?? null,
      utm_campaign: utm_campaign ?? null,
      coupon,
      landing: order.landing_site ?? null,
      source: order.source_name ?? null,
    },
  };
}

function verifyShopifyHmac(headers: Headers, body: string): boolean {
  const provided = headers.get('x-shopify-hmac-sha256');
  const secret = env.SHOPIFY_WEBHOOK_SECRET ?? env.SHOPIFY_APP_API_SECRET;
  if (!provided || !secret) return false;
  const computed = createHmac('sha256', secret).update(body, 'utf8').digest('base64');
  const a = Buffer.from(provided);
  const b = Buffer.from(computed);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const shopifyAdapter: SalesAdapter = {
  provider: 'shopify',

  async connect(input) {
    const payload = input.payload as { shop: string; accessToken: string };
    if (!payload?.shop || !payload?.accessToken) {
      throw new Error('shopify.connect: { shop, accessToken } required');
    }
    return {
      externalAccountId: payload.shop,
      displayName: payload.shop,
      config: { shop: payload.shop, accessToken: payload.accessToken } satisfies ShopifyConfig,
    };
  },

  async pullSince({ config, since }) {
    const cfg = config as ShopifyConfig;
    const sales: NormalizedSale[] = [];
    let url: string | null =
      `https://${cfg.shop}/admin/api/2024-07/orders.json?status=any&limit=250&created_at_min=${encodeURIComponent(
        since.toISOString(),
      )}`;
    while (url) {
      const res: Response = await fetch(url, {
        headers: {
          'X-Shopify-Access-Token': cfg.accessToken,
          Accept: 'application/json',
        },
      });
      if (!res.ok) {
        throw new Error(`Shopify pull failed: ${res.status}`);
      }
      const body = (await res.json()) as { orders: ShopifyOrder[] };
      for (const order of body.orders) sales.push(mapOrder(order));
      url = parseNextLink(res.headers.get('link')) ?? null;
    }
    return sales;
  },

  async handleWebhook({ headers, body }) {
    if (!verifyShopifyHmac(headers, body)) {
      throw new Error('invalid_hmac');
    }
    const order = JSON.parse(body) as ShopifyOrder;
    return [mapOrder(order)];
  },

  async disconnect() {
    // Shopify OAuth tokens can't be programmatically revoked; uninstallation
    // is done by the merchant or via the Partner dashboard. We no-op and let
    // the database row flip to 'disabled'.
  },
};

function parseNextLink(link: string | null): string | null {
  if (!link) return null;
  // Example: <https://.../orders.json?page_info=abc>; rel="next"
  for (const part of link.split(',')) {
    const m = /<([^>]+)>;\s*rel="next"/.exec(part.trim());
    if (m) return m[1] ?? null;
  }
  return null;
}

export const __internal = { mapOrder, verifyShopifyHmac, parseNextLink };
