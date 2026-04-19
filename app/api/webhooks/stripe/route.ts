import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { getStripe, isStripeConfigured } from '@/lib/billing/stripe';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';

export async function POST(req: NextRequest) {
  if (!isStripeConfigured() || !env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ received: true, note: 'stripe-not-configured' });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'missing signature' }, { status: 400 });

  const body = await req.text();
  let event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'invalid signature';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const brandId = session.metadata?.brand_id;
      const subscriptionId =
        typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
      if (brandId && subscriptionId) {
        await db
          .update(schema.brands)
          .set({
            status: 'active',
            stripeSubscriptionId: subscriptionId,
            billingCycleDay: new Date().getUTCDate(),
            updatedAt: new Date(),
          })
          .where(eq(schema.brands.id, brandId));
      }
      break;
    }
    // Phase 11 handles invoice.* and customer.subscription.* events.
    default:
      break;
  }

  return NextResponse.json({ received: true });
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
