import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';

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
  const fmt = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}م`;
    if (n >= 1000)    return `${(n / 1000).toFixed(0)}ك`;
    return String(Math.round(n));
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-card/95 backdrop-blur border border-border/50 rounded-xl p-3 shadow-elegant min-w-[140px]" dir="rtl">
        <p className="font-arabic font-semibold text-sm mb-2 text-foreground">{label}</p>
        {payload.map((p: any, i: number) => (
          <div key={i} className="flex items-center justify-between gap-3 text-xs font-arabic">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
              <span className="text-muted-foreground">{p.name}</span>
            </div>
            <span className="font-bold">{new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 0 }).format(p.value)}</span>
          </div>
        ))}
      </div>
    );
  };

  const CustomLegend = ({ payload }: any) => (
    <div className="flex justify-center gap-6 mt-2" dir="rtl">
      {payload?.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: entry.color }} />
          <span className="text-xs font-arabic text-muted-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  );

  const hasData = data.some(d => d.income > 0 || d.expense > 0);

  return (
    <Card className="luxury-card" dir="rtl">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 font-arabic text-base">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-jood-teal-900 to-jood-teal-700 flex items-center justify-center">
            <BarChart3 className="w-3.5 h-3.5 text-white" />
          </div>
          التدفق المالي — آخر ٦ أشهر
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} vertical={false} />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11, fontFamily: 'Cairo, sans-serif' }}
                />
                <YAxis
                  tickFormatter={fmt}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  width={36}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }} />
                <Legend content={<CustomLegend />} />
                <Bar dataKey="income"  name="الدخل"    fill="#0d5c63" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="المصاريف" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="savings" name="الادخار"  fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 flex flex-col items-center justify-center text-center gap-2">
            <BarChart3 className="w-10 h-10 text-muted-foreground/40" />
            <p className="font-arabic text-sm text-muted-foreground">لا توجد بيانات مالية بعد</p>
            <p className="font-arabic text-xs text-muted-foreground/60">
              سجّلي أول معاملة عبر جود أو زر «+ إضافة»
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MonthlyFlowChart;
