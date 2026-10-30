import React from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';
import { useLanguage } from '@/hooks/useLanguage';
import {
  SERIES, AXIS_TICK, GRID_PROPS, GlowFilter, GlassTooltip, compactNumber, useChartId,
} from './chartTheme';

interface MonthlyFlowData {
  month: string;
  income: number;
  expense: number;
  savings: number;
}

interface MonthlyFlowChartProps {
  data: MonthlyFlowData[];
  currency: string;
}

export const MonthlyFlowChart: React.FC<MonthlyFlowChartProps> = ({ data, currency }) => {
  const { t, tg, dir } = useLanguage();
  const id = useChartId('flow');

  const series = [
    { key: 'income' as const,  name: t('chart.flow.income'),  color: SERIES.income },
    { key: 'expense' as const, name: t('chart.flow.expense'), color: SERIES.expense },
    { key: 'savings' as const, name: t('chart.flow.savings'), color: SERIES.savings },
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <GlassTooltip dir={dir}>
        <p className="font-arabic font-semibold text-sm mb-1.5 text-foreground">{label}</p>
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-4 text-xs font-arabic leading-6">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
              {p.name}
            </span>
            <span className="font-mono font-bold text-foreground">
              {new Intl.NumberFormat('en', { maximumFractionDigits: 0 }).format(p.value)}
            </span>
          </div>
        ))}
        <p className="text-[10px] text-muted-foreground mt-1 font-mono">{currency}</p>
      </GlassTooltip>
    );
  };

  const hasData = data.some(d => d.income > 0 || d.expense > 0);

  return (
    <Card className="luxury-card" dir={dir}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 font-arabic text-base">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-jood-teal-900 to-jood-teal-700 flex items-center justify-center">
            <BarChart3 className="w-3.5 h-3.5 text-white" />
          </div>
          {t('chart.flow.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <>
            <div className="h-60" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    {series.slice(0, 2).map(s => (
                      <linearGradient key={s.key} id={`${id}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={s.color} stopOpacity={0.42} />
                        <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                      </linearGradient>
                    ))}
                    <GlowFilter id={`${id}-glow`} />
                  </defs>
                  <CartesianGrid {...GRID_PROPS} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={AXIS_TICK} dy={6} />
                  <YAxis tickFormatter={compactNumber} axisLine={false} tickLine={false} tick={AXIS_TICK} width={38} />
                  <Tooltip
                    content={<CustomTooltip />}
                    cursor={{ stroke: 'hsl(var(--jood-gold-400))', strokeOpacity: 0.45, strokeDasharray: '3 4' }}
                  />
                  {series.map(s => (
                    <Area
                      key={s.key}
                      type="monotone"
                      dataKey={s.key}
                      name={s.name}
                      stroke={s.color}
                      strokeWidth={s.key === 'savings' ? 2 : 2.5}
                      strokeDasharray={s.key === 'savings' ? '5 5' : undefined}
                      fill={s.key === 'savings' ? 'none' : `url(#${id}-${s.key})`}
                      filter={s.key === 'savings' ? undefined : `url(#${id}-glow)`}
                      dot={false}
                      activeDot={{ r: 5, strokeWidth: 2, stroke: 'hsl(var(--background))', fill: s.color }}
                      animationDuration={900}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-2 mt-3">
              {series.map(s => (
                <span key={s.key} className="inline-flex items-center gap-1.5 rounded-full bg-foreground/5 px-2.5 py-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-[11px] font-arabic text-muted-foreground">{s.name}</span>
                </span>
              ))}
            </div>
          </>
        ) : (
          <div className="h-64 flex flex-col items-center justify-center text-center gap-2">
            <BarChart3 className="w-10 h-10 text-muted-foreground/40" />
            <p className="font-arabic text-sm text-muted-foreground">{t('chart.flow.empty')}</p>
            <p className="font-arabic text-xs text-muted-foreground/60">
              {tg('chart.flow.empty.hint')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MonthlyFlowChart;
