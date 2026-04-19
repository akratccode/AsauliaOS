import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import { classify } from '@/lib/integrations/classify';
import type { AttributionRule, NormalizedSale } from '@/lib/integrations/types';
import { __internal as shopifyInternal } from '@/lib/integrations/shopify';
import { __internal as wooInternal } from '@/lib/integrations/woocommerce';
import { __internal as stripeInternal } from '@/lib/integrations/stripe-sales';

function sale(metadata: Record<string, unknown> = {}): NormalizedSale {
  return {
    externalId: 'x',
    amountCents: 10_000,
    currency: 'USD',
    occurredAt: new Date('2026-04-01T00:00:00Z'),
    metadata,
  };
}

describe('attribution classifier', () => {
  it('matches rule "all"', () => {
    const r: AttributionRule[] = [{ type: 'all' }];
    expect(classify(sale(), r).attributed).toBe(true);
  });

  it('matches utm_source', () => {
    const r: AttributionRule[] = [{ type: 'utm_source', values: ['asaulia'] }];
    expect(classify(sale({ utm_source: 'asaulia' }), r).attributed).toBe(true);
    expect(classify(sale({ utm_source: 'random' }), r).attributed).toBe(false);
  });

  it('matches utm_campaign_prefix', () => {
    const r: AttributionRule[] = [{ type: 'utm_campaign_prefix', prefix: 'q2_' }];
    expect(classify(sale({ utm_campaign: 'q2_launch' }), r).attributed).toBe(true);
    expect(classify(sale({ utm_campaign: 'q3_summer' }), r).attributed).toBe(false);
  });

  it('matches coupon', () => {
    const r: AttributionRule[] = [{ type: 'coupon', codes: ['SAVE10'] }];
    expect(classify(sale({ coupon: 'SAVE10' }), r).attributed).toBe(true);
    expect(classify(sale({ coupon: 'OTHER' }), r).attributed).toBe(false);
  });

  it('matches landing_page_prefix', () => {
    const r: AttributionRule[] = [{ type: 'landing_page_prefix', prefix: '/lp/' }];
    expect(classify(sale({ landing: '/lp/q2' }), r).attributed).toBe(true);
    expect(classify(sale({ landing: '/home' }), r).attributed).toBe(false);
  });

  it('returns first matching rule as reason', () => {
    const r: AttributionRule[] = [
      { type: 'coupon', codes: ['SAVE10'] },
      { type: 'all' },
    ];
    const res = classify(sale({ coupon: 'SAVE10' }), r);
    expect(res.attributed).toBe(true);
    expect(res.reason).toMatch(/^coupon:/);
  });

  it('returns null reason when no rule matches', () => {
    const r: AttributionRule[] = [{ type: 'coupon', codes: ['X'] }];
    expect(classify(sale({ coupon: 'Y' }), r).reason).toBeNull();
  });
});

describe('shopify adapter mapping', () => {
  it('maps a minimal order', () => {
    const normalized = shopifyInternal.mapOrder({
      id: 123,
      created_at: '2026-04-01T12:00:00Z',
      total_price: '99.95',
      currency: 'USD',
    });
    expect(normalized.externalId).toBe('123');
    expect(normalized.amountCents).toBe(9995);
    expect(normalized.currency).toBe('USD');
    expect(normalized.occurredAt.toISOString()).toBe('2026-04-01T12:00:00.000Z');
  });

  it('extracts UTMs from note_attributes', () => {
    const n = shopifyInternal.mapOrder({
      id: 1,
      created_at: '2026-04-01T00:00:00Z',
      total_price: '10.00',
      currency: 'USD',
      note_attributes: [
        { name: 'utm_source', value: 'asaulia' },
        { name: 'utm_medium', value: 'email' },
      ],
      discount_codes: [{ code: 'SAVE10' }],
    });
    expect(n.metadata).toMatchObject({
      utm_source: 'asaulia',
      utm_medium: 'email',
      coupon: 'SAVE10',
    });
  });

  it('falls back to landing_site query string for UTMs', () => {
    const n = shopifyInternal.mapOrder({
      id: 1,
      created_at: '2026-04-01T00:00:00Z',
      total_price: '10.00',
      currency: 'USD',
      landing_site: '/lp?utm_source=asaulia&utm_campaign=q2_launch',
    });
    expect(n.metadata.utm_source).toBe('asaulia');
    expect(n.metadata.utm_campaign).toBe('q2_launch');
  });

  it('parses Link rel="next"', () => {
    const next = shopifyInternal.parseNextLink(
      '<https://store/admin/orders.json?page_info=abc>; rel="next"',
    );
    expect(next).toBe('https://store/admin/orders.json?page_info=abc');
    expect(shopifyInternal.parseNextLink(null)).toBeNull();
    expect(
      shopifyInternal.parseNextLink(
        '<https://store/admin/orders.json?page_info=prev>; rel="previous"',
      ),
    ).toBeNull();
  });

  it('verifies HMAC signatures', () => {
    const body = '{"id":1}';
    const sig = createHmac('sha256', 'shh').update(body).digest('base64');
    const goodHeaders = new Headers({ 'x-shopify-hmac-sha256': sig });
    const badHeaders = new Headers({ 'x-shopify-hmac-sha256': 'deadbeef' });
    expect(shopifyInternal.verifyShopifyHmac(goodHeaders, body)).toBe(true);
    expect(shopifyInternal.verifyShopifyHmac(badHeaders, body)).toBe(false);
  });
});

describe('woocommerce adapter mapping', () => {
  it('maps an order with meta_data UTMs', () => {
    const n = wooInternal.mapOrder({
      id: 55,
      date_created_gmt: '2026-04-01T00:00:00',
      total: '49.99',
      currency: 'USD',
      meta_data: [
        { key: '_utm_source', value: 'asaulia' },
        { key: '_utm_campaign', value: 'q2_launch' },
      ],
      coupon_lines: [{ code: 'SAVE10' }],
    });
    expect(n.externalId).toBe('55');
    expect(n.amountCents).toBe(4999);
    expect(n.occurredAt.toISOString()).toBe('2026-04-01T00:00:00.000Z');
    expect(n.metadata.utm_source).toBe('asaulia');
    expect(n.metadata.coupon).toBe('SAVE10');
  });
});

describe('stripe-sales adapter mapping', () => {
  it('subtracts refunded amount and uppercases currency', () => {
    const n = stripeInternal.mapCharge({
      id: 'ch_123',
      amount: 10_000,
      amount_refunded: 2_500,
      currency: 'usd',
      created: 1_790_000_000,
      status: 'succeeded',
      metadata: { utm_source: 'asaulia' },
    });
    expect(n.externalId).toBe('ch_123');
    expect(n.amountCents).toBe(7_500);
    expect(n.currency).toBe('USD');
    expect(n.metadata.utm_source).toBe('asaulia');
  });
});

describe('crypto round-trip', () => {
  it('encrypts and decrypts a config object', async () => {
    const mod = await import('@/lib/integrations/crypto');
    const payload = { shop: 'store.myshopify.com', accessToken: 'shpat_xxx' };
    const cipher = mod.encryptConfig(payload);
    expect(Buffer.isBuffer(cipher)).toBe(true);
    const decoded = mod.decryptConfig<typeof payload>(cipher);
    expect(decoded).toEqual(payload);
  });
});
