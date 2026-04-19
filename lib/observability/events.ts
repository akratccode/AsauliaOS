import 'server-only';
import { getServerAnalytics } from '@/lib/analytics';

/**
 * Typed wrappers around PostHog server-side `.capture()`. Every call site uses
 * these — no stringly-typed event names scattered across handlers.
 *
 * If PostHog isn't configured (dev / tests), all functions are no-ops.
 */
export type CapturedEvent =
  | 'signup_completed'
  | 'onboarding_brand_saved'
  | 'onboarding_plan_saved'
  | 'onboarding_payment_succeeded'
  | 'deliverable_created'
  | 'deliverable_moved'
  | 'integration_connected'
  | 'integration_synced'
  | 'plan_changed'
  | 'invoice_paid'
  | 'payout_sent';

export function captureEvent(params: {
  event: CapturedEvent;
  distinctId: string;
  brandId?: string;
  properties?: Record<string, unknown>;
}): void {
  const ph = getServerAnalytics();
  if (!ph) return;
  ph.capture({
    event: params.event,
    distinctId: params.distinctId,
    properties: {
      ...(params.brandId ? { brand_id: params.brandId } : {}),
      ...(params.properties ?? {}),
    },
  });
}
