import type { NormalizedSale, SalesAdapter } from '../types';

type StripeSalesConfig = {
  stripeAccountId: string;
  // In v1 we use a platform-owned API key (STRIPE_SALES_SECRET_KEY). Stripe
  // Connect OAuth lands in Phase 11 polish.
};

type StripeCharge = {
  id: string;
  amount: number;
  amount_refunded?: number;
  currency: string;
  created: number;
  status: string;
  metadata?: Record<string, string>;
};

function mapCharge(charge: StripeCharge): NormalizedSale {
  return {
    externalId: charge.id,
    amountCents: charge.amount - (charge.amount_refunded ?? 0),
    currency: charge.currency.toUpperCase(),
    occurredAt: new Date(charge.created * 1000),
    metadata: { ...(charge.metadata ?? {}) },
  };
}

async function listCharges(
  apiKey: string,
  stripeAccountId: string,
  since: Date,
): Promise<StripeCharge[]> {
  const results: StripeCharge[] = [];
  let startingAfter: string | undefined;
  while (true) {
    const params = new URLSearchParams({
      'created[gte]': Math.floor(since.getTime() / 1000).toString(),
      limit: '100',
    });
    if (startingAfter) params.set('starting_after', startingAfter);
    const res = await fetch(`https://api.stripe.com/v1/charges?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Stripe-Account': stripeAccountId,
      },
    });
    if (!res.ok) throw new Error(`Stripe pull failed: ${res.status}`);
    const body = (await res.json()) as { data: StripeCharge[]; has_more: boolean };
    results.push(...body.data);
    if (!body.has_more || body.data.length === 0) break;
    startingAfter = body.data[body.data.length - 1]?.id;
    if (!startingAfter) break;
  }
  return results.filter((c) => c.status === 'succeeded');
}

export const stripeSalesAdapter: SalesAdapter = {
  provider: 'stripe',

  async connect(input) {
    const payload = input.payload as { stripeAccountId: string; displayName?: string };
    if (!payload?.stripeAccountId) {
      throw new Error('stripe-sales.connect: { stripeAccountId } required');
    }
    return {
      externalAccountId: payload.stripeAccountId,
      displayName: payload.displayName ?? payload.stripeAccountId,
      config: { stripeAccountId: payload.stripeAccountId } satisfies StripeSalesConfig,
    };
  },

  async pullSince({ config, since }) {
    const cfg = config as StripeSalesConfig;
    const apiKey = process.env.STRIPE_SALES_SECRET_KEY;
    if (!apiKey) throw new Error('STRIPE_SALES_SECRET_KEY is not set');
    const charges = await listCharges(apiKey, cfg.stripeAccountId, since);
    return charges.map(mapCharge);
  },

  async disconnect() {
    // Platform-managed API key; no per-connection revoke to issue.
  },
};

export const __internal = { mapCharge };
