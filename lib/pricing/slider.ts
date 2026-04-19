import { PRICING } from './constants';

export function sliderStopsFixedCents(stepCents = 10_000): number[] {
  const stops: number[] = [];
  for (let v = PRICING.MIN_FIXED_CENTS; v <= PRICING.MAX_FIXED_CENTS; v += stepCents) {
    stops.push(v);
  }
  if (stops[stops.length - 1] !== PRICING.MAX_FIXED_CENTS) {
    stops.push(PRICING.MAX_FIXED_CENTS);
  }
  return stops;
}

export function sliderValueFromPercent(pct: number): number {
  const clamped = Math.min(Math.max(pct, 0), 1);
  const span = PRICING.MAX_FIXED_CENTS - PRICING.MIN_FIXED_CENTS;
  return Math.round(PRICING.MIN_FIXED_CENTS + clamped * span);
}

export function percentFromSliderValue(fixedCents: number): number {
  const span = PRICING.MAX_FIXED_CENTS - PRICING.MIN_FIXED_CENTS;
  const clamped = Math.min(
    Math.max(fixedCents, PRICING.MIN_FIXED_CENTS),
    PRICING.MAX_FIXED_CENTS,
  );
  return (clamped - PRICING.MIN_FIXED_CENTS) / span;
}

export function formatCents(cents: number): string {
  const dollars = cents / 100;
  return dollars.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: dollars < 100 ? 2 : 0,
  });
}

export function formatBps(bps: number): string {
  return `${(bps / 100).toFixed(2).replace(/\.00$/, '')}%`;
}
