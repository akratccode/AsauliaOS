import 'server-only';
import Stripe from 'stripe';
import { env } from '@/lib/env';

let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured.');
  }
  cached ??= new Stripe(env.STRIPE_SECRET_KEY, {
    appInfo: { name: 'Asaulia', version: '0.1.0' },
  });
  return cached;
}

export function isStripeConfigured(): boolean {
  return Boolean(env.STRIPE_SECRET_KEY);
}
