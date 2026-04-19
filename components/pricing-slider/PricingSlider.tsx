'use client';

import { useMemo, useState } from 'react';
import {
  PRICING,
  formatBps,
  formatCents,
  quote,
  sliderStopsFixedCents,
  variableFromFixed,
} from '@/lib/pricing';

type Props = {
  defaultFixedCents?: number;
  defaultProjectedMonthlySalesCents?: number;
  name?: string;
  variableName?: string;
};

export function PricingSlider({
  defaultFixedCents = 19_900,
  defaultProjectedMonthlySalesCents = 300_000,
  name = 'fixedAmountCents',
  variableName = 'variablePercentBps',
}: Props) {
  const stops = useMemo(() => sliderStopsFixedCents(), []);
  const [fixedCents, setFixedCents] = useState(() =>
    snapToStops(defaultFixedCents, stops),
  );
  const [projection, setProjection] = useState(defaultProjectedMonthlySalesCents);

  const variableBps = variableFromFixed(fixedCents);
  const selected = quote({
    fixedAmountCents: fixedCents,
    variablePercentBps: variableBps,
    attributedSalesCents: projection,
  });
  const starter = quote({
    fixedAmountCents: PRICING.MIN_FIXED_CENTS,
    variablePercentBps: PRICING.MAX_VARIABLE_BPS,
    attributedSalesCents: projection,
  });
  const pro = quote({
    fixedAmountCents: PRICING.MAX_FIXED_CENTS,
    variablePercentBps: PRICING.MIN_VARIABLE_BPS,
    attributedSalesCents: projection,
  });

  const cheapest = [
    { key: 'current', total: selected.totalAmountCents },
    { key: 'starter', total: starter.totalAmountCents },
    { key: 'pro', total: pro.totalAmountCents },
  ].sort((a, b) => a.total - b.total)[0]?.key;

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const direction = e.key === 'ArrowLeft' ? -1 : 1;
      setFixedCents((v) => {
        const idx = stops.findIndex((s) => s >= v);
        const next = Math.max(0, Math.min(stops.length - 1, idx + direction));
        return stops[next] ?? v;
      });
    }
    if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault();
      const direction = e.key === 'PageDown' ? -1 : 1;
      setFixedCents((v) => clampFixed(v + direction * 50_000));
    }
  };

  return (
    <div
      className="border-fg-4/15 bg-bg-1 rounded-2xl border p-6 space-y-6"
      data-testid="pricing-slider"
    >
      <div className="flex items-baseline justify-between gap-6">
        <div>
          <div className="text-fg-4 text-xs uppercase tracking-[0.16em]">Your plan</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-fg-1 font-serif text-5xl italic">
              {formatCents(fixedCents)}
            </span>
            <span className="text-fg-3 text-sm">/ month</span>
          </div>
          <p className="text-fg-3 mt-1 text-sm" data-testid="derived-variable">
            + {formatBps(variableBps)} of attributed sales
          </p>
        </div>
        <div className="text-right">
          <div className="text-fg-4 text-xs uppercase tracking-[0.16em]">Projected total</div>
          <div className="text-fg-1 mt-1 font-serif text-3xl italic">
            {formatCents(selected.totalAmountCents)}
          </div>
        </div>
      </div>

      <input
        type="range"
        min={PRICING.MIN_FIXED_CENTS}
        max={PRICING.MAX_FIXED_CENTS}
        step={10_000}
        value={fixedCents}
        onChange={(e) => setFixedCents(Number(e.target.value))}
        onKeyDown={onKeyDown}
        aria-label="Monthly fixed fee"
        aria-valuetext={`${formatCents(fixedCents)} fixed, ${formatBps(variableBps)} variable`}
        className="w-full accent-[var(--color-asaulia-blue)]"
      />

      <input type="hidden" name={name} value={fixedCents} readOnly />
      <input type="hidden" name={variableName} value={variableBps} readOnly />

      <div className="flex items-center justify-between text-xs uppercase tracking-[0.12em]">
        <span className="text-fg-3">
          Starter · {formatCents(PRICING.MIN_FIXED_CENTS)} + {formatBps(PRICING.MAX_VARIABLE_BPS)}
        </span>
        <span className="text-fg-3">
          Pro · {formatCents(PRICING.MAX_FIXED_CENTS)} + {formatBps(PRICING.MIN_VARIABLE_BPS)}
        </span>
      </div>

      <div className="border-fg-4/15 border-t pt-6 space-y-3">
        <label className="flex items-center justify-between text-sm">
          <span className="text-fg-2">Expected monthly attributed sales</span>
          <input
            type="number"
            min={0}
            step={10_000}
            value={projection}
            onChange={(e) => setProjection(Math.max(0, Number(e.target.value)))}
            className="border-fg-4/20 bg-bg-2 text-fg-1 w-28 rounded-md border px-2 py-1 text-right text-sm"
            aria-label="Expected monthly attributed sales in cents"
          />
        </label>
        <div className="grid grid-cols-3 gap-3 text-xs">
          <ProjectionCard
            label="Current"
            sublabel={`${formatCents(fixedCents)} + ${formatBps(variableBps)}`}
            amount={selected.totalAmountCents}
            highlight={cheapest === 'current'}
          />
          <ProjectionCard
            label="Starter"
            sublabel={`${formatCents(PRICING.MIN_FIXED_CENTS)} + ${formatBps(PRICING.MAX_VARIABLE_BPS)}`}
            amount={starter.totalAmountCents}
            highlight={cheapest === 'starter'}
          />
          <ProjectionCard
            label="Pro"
            sublabel={`${formatCents(PRICING.MAX_FIXED_CENTS)} + ${formatBps(PRICING.MIN_VARIABLE_BPS)}`}
            amount={pro.totalAmountCents}
            highlight={cheapest === 'pro'}
          />
        </div>
      </div>
    </div>
  );
}

function ProjectionCard({
  label,
  sublabel,
  amount,
  highlight,
}: {
  label: string;
  sublabel: string;
  amount: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 ${
        highlight
          ? 'border-asaulia-blue/60 bg-asaulia-blue/10 text-fg-1'
          : 'border-fg-4/15 bg-bg-2 text-fg-2'
      }`}
    >
      <div className="text-fg-4 text-[10px] uppercase tracking-[0.14em]">{label}</div>
      <div className="font-serif text-lg italic">{formatCents(amount)}</div>
      <div className="text-fg-3 text-[11px]">{sublabel}</div>
    </div>
  );
}

function snapToStops(value: number, stops: number[]): number {
  let closest = stops[0] ?? 0;
  let minDelta = Infinity;
  for (const s of stops) {
    const delta = Math.abs(s - value);
    if (delta < minDelta) {
      minDelta = delta;
      closest = s;
    }
  }
  return closest;
}

function clampFixed(v: number): number {
  return Math.max(PRICING.MIN_FIXED_CENTS, Math.min(PRICING.MAX_FIXED_CENTS, v));
}
