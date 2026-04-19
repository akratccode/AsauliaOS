import type { NormalizedSale, SalesAdapter } from '../types';

type WooConfig = {
  baseUrl: string; // e.g. "https://shop.example.com"
  consumerKey: string;
  consumerSecret: string;
};

type WooMeta = { key?: string; value?: unknown };

type WooOrder = {
  id: number;
  date_created_gmt: string;
  total: string;
  currency: string;
  meta_data?: WooMeta[];
  coupon_lines?: Array<{ code: string }>;
};

function metaValue(meta: WooMeta[] | undefined, key: string): string | undefined {
  const hit = (meta ?? []).find((m) => m.key === key);
  return typeof hit?.value === 'string' ? hit.value : undefined;
}

function basicAuthHeader(key: string, secret: string): string {
  return `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}`;
}

function mapOrder(order: WooOrder): NormalizedSale {
  const utm_source = metaValue(order.meta_data, '_utm_source');
  const utm_medium = metaValue(order.meta_data, '_utm_medium');
  const utm_campaign = metaValue(order.meta_data, '_utm_campaign');
  const landing = metaValue(order.meta_data, '_landing_page');
  return {
    externalId: String(order.id),
    amountCents: Math.round(Number(order.total) * 100),
    currency: order.currency,
    occurredAt: new Date(`${order.date_created_gmt}Z`),
    metadata: {
      utm_source: utm_source ?? null,
      utm_medium: utm_medium ?? null,
      utm_campaign: utm_campaign ?? null,
      coupon: order.coupon_lines?.[0]?.code ?? null,
      landing: landing ?? null,
    },
  };
}

export const woocommerceAdapter: SalesAdapter = {
  provider: 'woocommerce',

  async connect(input) {
    const payload = input.payload as WooConfig;
    if (!payload?.baseUrl || !payload?.consumerKey || !payload?.consumerSecret) {
      throw new Error('woocommerce.connect: { baseUrl, consumerKey, consumerSecret } required');
    }
    // Smoke call: GET /wp-json/wc/v3/system_status (optional) — we skip a
    // network round-trip here and trust the form; the next pullSince will
    // surface bad credentials.
    return {
      externalAccountId: new URL(payload.baseUrl).hostname,
      displayName: new URL(payload.baseUrl).hostname,
      config: payload,
    };
  },

  async pullSince({ config, since }) {
    const cfg = config as WooConfig;
    const sales: NormalizedSale[] = [];
    let page = 1;
    while (true) {
      const url = `${cfg.baseUrl.replace(/\/$/, '')}/wp-json/wc/v3/orders?after=${encodeURIComponent(
        since.toISOString(),
      )}&per_page=100&page=${page}`;
      const res = await fetch(url, {
        headers: {
          Authorization: basicAuthHeader(cfg.consumerKey, cfg.consumerSecret),
          Accept: 'application/json',
        },
      });
      if (!res.ok) throw new Error(`WooCommerce pull failed: ${res.status}`);
      const body = (await res.json()) as WooOrder[];
      if (body.length === 0) break;
      for (const order of body) sales.push(mapOrder(order));
      if (body.length < 100) break;
      page += 1;
      if (page > 100) break; // safety cap
    }
    return sales;
  },

  async disconnect() {
    // No server-side revocation — the merchant disables the REST API key in
    // their WooCommerce admin.
  },
};

export const __internal = { mapOrder };
