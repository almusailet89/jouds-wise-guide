import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GlassDonut } from './GlassDonut';
import { PALETTE, compactNumber } from './chartTheme';
import { PieChart as PieIcon } from 'lucide-react';
import type { FinancialEntry } from '@/hooks/useFinancialDashboard';
import { useLanguage } from '@/hooks/useLanguage';
import { EmptyState } from '@/components/ui/empty-state';

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

interface SpendingBreakdownChartProps {
  entries: FinancialEntry[];
  currency: string;
}

export const SpendingBreakdownChart: React.FC<SpendingBreakdownChartProps> = ({ entries, currency }) => {
  const { t, tg, lang, dir } = useLanguage();

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
  const slices = data.map((d, i) => ({ name: d.name, value: d.value, color: PALETTE[i % PALETTE.length] }));

  return (
    <Card className="luxury-card" dir={dir}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 font-arabic text-base">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-jood-gold-500 to-amber-700 flex items-center justify-center">
            <PieIcon className="w-3.5 h-3.5 text-white" />
          </div>
          {t('chart.spending.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <GlassDonut
            data={slices}
            dir={dir}
            centerLabel={t('chart.spending.total').replace(/[:：]\s*$/, '')}
            centerValue={compactNumber(total)}
            centerSub={currency}
            formatValue={(slice, share) => (
              <>
                <span className="font-mono font-bold text-foreground">{fmt(slice.value)}</span>
                <span className="text-muted-foreground mx-1">{currency}</span>
                <span className="text-muted-foreground">· {(share * 100).toFixed(1)}%</span>
              </>
            )}
          />
        ) : (
          <div className="h-64 flex items-center justify-center">
            <EmptyState
              orbSize={80}
              title={t('chart.spending.empty')}
              hint={tg('chart.spending.empty.hint')}
              className="py-0"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SpendingBreakdownChart;
