import type { CSSProperties } from 'react';

type Point = { date: string; cents: number };

type Props = {
  data: Point[];
  width?: number;
  height?: number;
  className?: string;
  strokeClass?: string;
  fillClass?: string;
};

export function Sparkline({
  data,
  width = 480,
  height = 96,
  className,
  strokeClass = 'stroke-asaulia-blue-soft',
  fillClass = 'fill-asaulia-blue/15',
}: Props) {
  if (data.length === 0) {
    return (
      <div
        className={`text-fg-3 flex items-center justify-center text-xs ${className ?? ''}`}
        style={{ height }}
      >
        No attributed sales yet in this period.
      </div>
    );
  }

  const max = Math.max(1, ...data.map((d) => d.cents));
  const step = data.length > 1 ? width / (data.length - 1) : width;
  const points = data.map((d, i) => {
    const x = i * step;
    const y = height - (d.cents / max) * (height - 8) - 4;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const path = `M ${points.join(' L ')}`;
  const area = `${path} L ${(data.length - 1) * step},${height} L 0,${height} Z`;

  const style: CSSProperties = { maxWidth: '100%', height: 'auto' };

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={className}
      style={style}
      aria-label="Daily attributed sales chart"
    >
      <path d={area} className={fillClass} />
      <path d={path} className={`${strokeClass} fill-none`} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
