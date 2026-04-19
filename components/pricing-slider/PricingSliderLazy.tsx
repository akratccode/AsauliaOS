'use client';

import dynamic from 'next/dynamic';

type Props = {
  defaultFixedCents?: number;
  defaultProjectedMonthlySalesCents?: number;
  name?: string;
  variableName?: string;
};

const PricingSlider = dynamic(
  () => import('./PricingSlider').then((m) => m.PricingSlider),
  {
    ssr: false,
    loading: () => (
      <div className="border-fg-4/15 bg-bg-1 h-64 animate-pulse rounded-2xl border" />
    ),
  },
);

export function PricingSliderLazy(props: Props) {
  return <PricingSlider {...props} />;
}
