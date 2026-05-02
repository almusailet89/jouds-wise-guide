import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Plus, RefreshCw, FileText } from 'lucide-react';
import { useFinancialDashboard } from '@/hooks/useFinancialDashboard';
import { WalletSummary } from './WalletSummary';
import { SpendingBreakdownChart } from './SpendingBreakdownChart';
import { MonthlyFlowChart } from './MonthlyFlowChart';
import { AddEntryModal } from './AddEntryModal';
import { AddHoldingModal } from './AddHoldingModal';
import { FinancialLedgerDrawer } from './FinancialLedgerDrawer';
import { PortfolioTable } from './PortfolioTable';
import { AllocationChart } from './AllocationChart';
import { InsightsPanel } from './InsightsPanel';
import { NewsPanel } from './NewsPanel';
import { ZakatCard } from './ZakatCard';
import FinanceExtras from './FinanceExtras';
import { cn } from '@/lib/utils';

// ─── Time filter options ────────────────────────────────────────────────────
type Period = 'month' | '30d' | 'ytd';
const PERIODS: { value: Period; label: string }[] = [
  { value: 'month', label: 'هذا الشهر' },
  { value: '30d',   label: '٣٠ يوم' },
  { value: 'ytd',   label: 'هذا العام' },
];

// ─── Filter entries by period ────────────────────────────────────────────────
function filterByPeriod(entries: any[], period: Period) {
  const now = new Date();
  return entries.filter(e => {
    const d = new Date(e.date);
    if (period === 'month') {
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
    if (period === '30d') {
      return (now.getTime() - d.getTime()) <= 30 * 24 * 60 * 60 * 1000;
    }
    // ytd
    return d.getFullYear() === now.getFullYear();
  });
}

const PERIOD_LABEL: Record<Period, string> = {
  month: 'هذا الشهر',
  '30d': '٣٠ يوم',
  ytd:   'هذا العام',
};

// ═══════════════════════════════════════════════════════════════════════════
export const FinancialDashboard: React.FC = () => {
  const [period, setPeriod] = useState<Period>('month');
  const [showAddEntry,   setShowAddEntry]   = useState(false);
  const [showAddHolding, setShowAddHolding] = useState(false);
  const [showLedger,     setShowLedger]     = useState(false);

  const {
    financialEntries, portfolioHoldings, portfolioSummary,
    insights, news, loading,
    monthlyBudget, updateMonthlyBudget,
    getMonthlyFlow,
    refreshPrices, fetchInsights,
  } = useFinancialDashboard();

  // Filtered entries for the selected period
  const filteredEntries = useMemo(() => filterByPeriod(financialEntries, period), [financialEntries, period]);

  // Allocation chart data
  const allocationData = useMemo(() => {
    if (!portfolioSummary?.asset_allocation) return [];
    return Object.entries(portfolioSummary.asset_allocation).map(([type, pct]) => ({
      name: type === 'stock' ? 'أسهم' : type === 'crypto' ? 'كريبتو' : type === 'real_estate' ? 'عقار' : type,
      value: Number(pct),
      color: '',
    }));
  }, [portfolioSummary]);

  // Monthly flow (always 6 months, not filtered by period)
  const monthlyFlowData = useMemo(() => getMonthlyFlow(6), [getMonthlyFlow]);

  const currency = 'SAR';

  return (
    <div className="space-y-6" dir="rtl">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-black font-arabic text-foreground">محفظتي</h2>
          <p className="text-sm text-muted-foreground font-arabic mt-0.5">
            كل شيء في مكان واحد — الرصيد، الميزانية، الاستثمار
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Period filter */}
          <div className="flex rounded-xl border border-border/50 overflow-hidden bg-card/50">
            {PERIODS.map(p => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={cn(
                  'px-3 py-1.5 text-xs font-arabic transition-all duration-150',
                  period === p.value
                    ? 'bg-jood-teal-900 text-white font-bold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/40',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          <Button
            onClick={() => setShowLedger(true)}
            variant="outline"
            size="sm"
            className="gap-1.5 font-arabic text-xs border-border/50"
          >
            <FileText className="w-3.5 h-3.5" />
            السجل الكامل
          </Button>

          <Button
            onClick={refreshPrices}
            disabled={loading}
            variant="outline"
            size="sm"
            className="gap-1.5 font-arabic text-xs border-border/50"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            تحديث
          </Button>

          <Button
            onClick={() => setShowAddEntry(true)}
            size="sm"
            className="gap-1.5 font-arabic text-xs bg-jood-teal-900 hover:bg-jood-teal-700 text-white"
          >
            <Plus className="w-3.5 h-3.5" />
            إضافة معاملة
          </Button>
        </div>
      </div>

      {/* ── Wallet + Budget (the one wallet) ──────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <WalletSummary
          entries={filteredEntries}
          monthlyBudget={monthlyBudget}
          currency={currency}
          onUpdateBudget={updateMonthlyBudget}
          periodLabel={PERIOD_LABEL[period]}
        />
      </motion.div>

      {/* ── Chat hint strip ────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 rounded-xl bg-jood-teal-900/5 border border-jood-teal-700/20 px-4 py-2.5">
        <span className="text-lg">💬</span>
        <p className="text-xs font-arabic text-muted-foreground">
          يمكنك إدخال أي معاملة أو تحديث الميزانية بصوتك عبر{' '}
          <span className="font-bold text-jood-teal-700">المجلس</span> أو بالكتابة في{' '}
          <span className="font-bold text-jood-teal-700">محادثة جود</span> — مثال: «صرفت ٣٠٠ ريال على التسوق» أو «حدّدي ميزانيتي بـ ٨٠٠٠ ريال»
        </p>
      </div>

      {/* ── Spending charts ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
          <SpendingBreakdownChart entries={filteredEntries} currency={currency} />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }}>
          <MonthlyFlowChart data={monthlyFlowData} currency={currency} />
        </motion.div>
      </div>

      {/* ── Finance extras (salary countdown, goals, projections) ─────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
        <FinanceExtras />
      </motion.div>

      {/* ── Portfolio ─────────────────────────────────────────────────── */}
      {portfolioHoldings.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="space-y-5"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold font-arabic text-foreground">المحفظة الاستثمارية</h3>
            <Button
              onClick={() => setShowAddHolding(true)}
              size="sm"
              variant="outline"
              className="gap-1.5 font-arabic text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              إضافة أصل
            </Button>
          </div>
          <PortfolioTable holdings={portfolioHoldings} />
          <AllocationChart data={allocationData} title="توزيع الأصول" />
        </motion.div>
      )}

      {/* Add holding button if portfolio is empty */}
      {portfolioHoldings.length === 0 && (
        <div className="text-center py-6 rounded-xl border border-dashed border-border/50">
          <p className="font-arabic text-sm text-muted-foreground mb-3">لا توجد أصول في المحفظة بعد</p>
          <Button
            onClick={() => setShowAddHolding(true)}
            size="sm"
            variant="outline"
            className="gap-1.5 font-arabic text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            أضيفي أول أصل
          </Button>
        </div>
      )}

      {/* ── AI Insights + News ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <InsightsPanel insights={insights} loading={loading} onRefresh={fetchInsights} />
        <NewsPanel news={news} loading={loading} />
      </div>

      {/* ── Zakat ──────────────────────────────────────────────────────── */}
      <ZakatCard />

      {/* ── Modals ────────────────────────────────────────────────────── */}
      <AddEntryModal   open={showAddEntry}   onOpenChange={setShowAddEntry} />
      <AddHoldingModal open={showAddHolding} onOpenChange={setShowAddHolding} />
      <FinancialLedgerDrawer open={showLedger} onOpenChange={setShowLedger} />
    </div>
  );
};
