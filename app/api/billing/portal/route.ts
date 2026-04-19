import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth/rbac';
import { db, schema } from '@/lib/db';
import { resolveActiveBrand, requireClientBrandAccess } from '@/lib/brand/context';
import { getStripe, isStripeConfigured } from '@/lib/billing/stripe';
import { env } from '@/lib/env';

export async function POST() {
  const actor = await requireAuth();
  const { active } = await resolveActiveBrand(actor);
  if (!active) return NextResponse.json({ error: 'no_brand' }, { status: 404 });
  await requireClientBrandAccess(actor, active.id);

  if (!isStripeConfigured()) {
    return NextResponse.redirect(`${env.NEXT_PUBLIC_APP_URL}/billing?portal=unavailable`);
  }

  const [brand] = await db
    .select({ stripeCustomerId: schema.brands.stripeCustomerId })
    .from(schema.brands)
    .where(eq(schema.brands.id, active.id))
    .limit(1);

  if (!brand?.stripeCustomerId) {
    return NextResponse.redirect(`${env.NEXT_PUBLIC_APP_URL}/billing?portal=missing`);
  }

  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: brand.stripeCustomerId,
    return_url: `${env.NEXT_PUBLIC_APP_URL}/billing`,
  });
  return NextResponse.redirect(session.url);
}
