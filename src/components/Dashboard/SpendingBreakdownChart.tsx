import React, { useMemo } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart as PieIcon } from 'lucide-react';
import type { FinancialEntry } from '@/hooks/useFinancialDashboard';
import { useLanguage } from '@/hooks/useLanguage';

// ─── Category display names (Arabic) ─────────────────────────────────────────
const CAT_AR: Record<string, string> = {
  Salary: 'الراتب', Food: 'مطاعم وطعام', Transportation: 'مواصلات',
  Housing: 'سكن وإيجار', Healthcare: 'صحة', Entertainment: 'ترفيه',
  Shopping: 'تسوق', Bills: 'فواتير', Education: 'تعليم',
  Freelance: 'عمل حر', Investment: 'استثمار', Business: 'أعمال',
  Bonus: 'مكافأة', savings: 'ادخار', general: 'عام',
  'Emergency Fund': 'طوارئ', 'Goal-based': 'هدف', Other: 'أخرى',
};

// ─── Category display names (English, including Arabic keys for legacy data) ─
const CAT_EN: Record<string, string> = {
  Salary: 'Salary', Food: 'Food & Dining', Transportation: 'Transport',
  Housing: 'Housing & Rent', Healthcare: 'Health', Entertainment: 'Entertainment',
  Shopping: 'Shopping', Bills: 'Bills', Education: 'Education',
  Freelance: 'Freelance', Investment: 'Investment', Business: 'Business',
  Bonus: 'Bonus', savings: 'Savings', general: 'General',
  'Emergency Fund': 'Emergency Fund', 'Goal-based': 'Goal', Other: 'Other',
  // Arabic keys (for data entered in Arabic)
  'الراتب': 'Salary', 'مطاعم وطعام': 'Food & Dining', 'مواصلات': 'Transport',
  'سكن وإيجار': 'Housing & Rent', 'صحة': 'Health', 'ترفيه': 'Entertainment',
  'تسوق': 'Shopping', 'فواتير': 'Bills', 'تعليم': 'Education',
  'عمل حر': 'Freelance', 'استثمار': 'Investment', 'أعمال': 'Business',
  'مكافأة': 'Bonus', 'ادخار': 'Savings', 'عام': 'General',
  'صندوق الطوارئ': 'Emergency Fund', 'هدف': 'Goal', 'أخرى': 'Other',
};

const COLORS = [
  '#0d5c63', '#d97706', '#8b5cf6', '#ef4444',
  '#10b981', '#f59e0b', '#3b82f6', '#6b7280',
];

interface SpendingBreakdownChartProps {
  entries: FinancialEntry[];
  currency: string;
}

export const SpendingBreakdownChart: React.FC<SpendingBreakdownChartProps> = ({ entries, currency }) => {
  const { t, lang, dir } = useLanguage();

  const data = useMemo(() => {
    const expenseEntries = entries.filter(e => e.type === 'expense');
    const map: Record<string, number> = {};
    for (const e of expenseEntries) {
      const cat = e.category?.trim() || (lang === 'ar' ? 'عام' : 'General');
      map[cat] = (map[cat] || 0) + Number(e.amount);
    }
    const sorted = Object.entries(map).sort(([, a], [, b]) => b - a);
    const displayName = (name: string) =>
      lang === 'ar' ? (CAT_AR[name] || name) : (CAT_EN[name] || name);

    if (sorted.length <= 7) return sorted.map(([name, value]) => ({ name: displayName(name), value, rawName: name }));
    const top6 = sorted.slice(0, 6);
    const otherSum = sorted.slice(6).reduce((s, [, v]) => s + v, 0);
    return [
      ...top6.map(([name, value]) => ({ name: displayName(name), value, rawName: name })),
      { name: t('chart.spending.other'), value: otherSum, rawName: 'other' },
    ];
  }, [entries, lang, t]);

  const total = data.reduce((s, d) => s + d.value, 0);
  const fmt   = (n: number) => new Intl.NumberFormat('en', { maximumFractionDigits: 0 }).format(n);

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0];
    const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : '0';
    return (
      <div className="bg-card/95 backdrop-blur border border-border/50 rounded-xl p-3 shadow-elegant" dir={dir}>
        <p className="font-arabic font-semibold text-sm text-foreground">{d.name}</p>
        <p className="font-arabic text-sm mt-0.5">
          <span className="font-bold">{fmt(d.value)}</span>
          <span className="text-muted-foreground mr-1">{currency}</span>
        </p>
        <p className="text-xs text-muted-foreground font-arabic">{pct}{t('chart.spending.pct.suffix')}</p>
      </div>
    );
  };

  const CustomLegend = ({ payload }: any) => (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-3" dir={dir}>
      {payload?.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-xs font-arabic text-muted-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  );

  return (
    <Card className="luxury-card" dir={dir}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 font-arabic text-base">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-jood-gold-500 to-amber-700 flex items-center justify-center">
            <PieIcon className="w-3.5 h-3.5 text-white" />
          </div>
          {t('chart.spending.title')}
          {data.length > 0 && (
            <span className="text-xs font-normal text-muted-foreground mr-auto">
              {t('chart.spending.total')} {fmt(total)} {currency}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="45%"
                  innerRadius={52}
                  outerRadius={85}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {data.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend content={<CustomLegend />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 flex flex-col items-center justify-center text-center gap-2">
            <PieIcon className="w-10 h-10 text-muted-foreground/40" />
            <p className="font-arabic text-sm text-muted-foreground">{t('chart.spending.empty')}</p>
            <p className="font-arabic text-xs text-muted-foreground/60">
              {t('chart.spending.empty.hint')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SpendingBreakdownChart;
