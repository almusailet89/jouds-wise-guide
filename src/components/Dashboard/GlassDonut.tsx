import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { GlowFilter, GlassTooltip, useChartId } from './chartTheme';

export interface DonutSlice {
  name: string;
  value: number;
  color: string;
}

interface GlassDonutProps {
  data: DonutSlice[];
  centerLabel: string;
  centerValue: string;
  centerSub?: string;
  formatValue: (slice: DonutSlice, share: number) => React.ReactNode;
  dir?: string;
}

export const GlassDonut: React.FC<GlassDonutProps> = ({
  data, centerLabel, centerValue, centerSub, formatValue, dir,
}) => {
  const id = useChartId('donut');
  const total = data.reduce((s, d) => s + d.value, 0);
  const share = (v: number) => (total > 0 ? v / total : 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const slice = payload[0].payload as DonutSlice;
    return (
      <GlassTooltip dir={dir}>
        <p className="font-arabic font-semibold text-sm text-foreground flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: slice.color }} />
          {slice.name}
        </p>
        <div className="text-xs font-arabic mt-1">{formatValue(slice, share(slice.value))}</div>
      </GlassTooltip>
    );
  };

  return (
    <div className="space-y-4">
      <div className="relative h-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <defs>
              <GlowFilter id={`${id}-glow`} blur={3} />
            </defs>
            <Pie
              data={data}
              dataKey="value"
              cx="50%"
              cy="50%"
              innerRadius="72%"
              outerRadius="94%"
              paddingAngle={3}
              cornerRadius={8}
              startAngle={90}
              endAngle={-270}
              stroke="none"
              filter={`url(#${id}-glow)`}
              animationDuration={900}
            >
              {data.map(slice => (
                <Cell key={slice.name} fill={slice.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[11px] font-arabic text-muted-foreground">{centerLabel}</span>
          <span className="text-2xl font-bold font-mono text-foreground leading-tight">{centerValue}</span>
          {centerSub && <span className="text-[10px] font-mono text-muted-foreground">{centerSub}</span>}
        </div>
      </div>

      <ul className="flex flex-wrap justify-center gap-x-5 gap-y-2" dir={dir}>
        {data.map(slice => (
          <li key={slice.name} className="flex items-center gap-1.5 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: slice.color }} />
            <span className="text-xs font-arabic text-muted-foreground truncate max-w-[9rem]">{slice.name}</span>
            <span className="text-xs font-mono font-semibold text-foreground">
              {Math.round(share(slice.value) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};
