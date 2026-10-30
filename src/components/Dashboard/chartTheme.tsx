import React from 'react';
import { cn } from '@/lib/utils';

export const SERIES = {
  income:  'hsl(var(--jood-teal-400))',
  expense: 'hsl(var(--jood-warn))',
  savings: 'hsl(var(--jood-gold-500))',
} as const;

export const PALETTE = [
  'hsl(var(--jood-teal-400))',
  'hsl(var(--jood-gold-400))',
  'hsl(var(--jood-warn))',
  'hsl(var(--jood-teal-300))',
  'hsl(var(--jood-gold-300))',
  'hsl(var(--jood-teal-600))',
  'hsl(var(--jood-gold-700))',
  'hsl(var(--jood-muted))',
];

export const AXIS_TICK = { fill: 'hsl(var(--muted-foreground))', fontSize: 11 };
export const GRID_PROPS = {
  strokeDasharray: '2 6',
  stroke: 'hsl(var(--foreground))',
  strokeOpacity: 0.1,
  vertical: false,
} as const;

// SVG ids must be unique per chart instance and must not contain ':' (useId output does).
export function useChartId(prefix: string) {
  return `${prefix}-${React.useId().replace(/:/g, '')}`;
}

export const GlowFilter: React.FC<{ id: string; blur?: number }> = ({ id, blur = 4 }) => (
  <filter id={id} x="-20%" y="-40%" width="140%" height="180%">
    <feGaussianBlur stdDeviation={blur} result="blur" />
    <feMerge>
      <feMergeNode in="blur" />
      <feMergeNode in="SourceGraphic" />
    </feMerge>
  </filter>
);

// Tooltips sit over busy chart lines, so they use a much denser glass than cards.
export const GlassTooltip: React.FC<{ dir?: string; className?: string; children: React.ReactNode }> = ({
  dir, className, children,
}) => (
  <div
    dir={dir}
    className={cn('glass rounded-xl px-3 py-2.5 min-w-[140px]', className)}
    style={{ '--glass-alpha': 0.86 } as React.CSSProperties}
  >
    {children}
  </div>
);

export const compactNumber = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return String(Math.round(n));
};
