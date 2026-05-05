import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp, TrendingDown, Wallet, Target, Pencil, Check, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/hooks/useLanguage';
import type { FinancialEntry } from '@/hooks/useFinancialDashboard';

interface WalletSummaryProps {
  entries: FinancialEntry[];         // filtered by current time period
  monthlyBudget: number;             // from profiles
  currency: string;
  onUpdateBudget: (b: number) => void;
  periodLabel: string;               // e.g. "هذا الشهر"
}

export const WalletSummary: React.FC<WalletSummaryProps> = ({
  entries, monthlyBudget, currency, onUpdateBudget, periodLabel,
}) => {
  const { t, dir } = useLanguage();
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');

  // ── Computed totals ─────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const income  = entries.filter(e => e.type === 'income').reduce((s, e) => s + Number(e.amount), 0);
    const expense = entries.filter(e => e.type === 'expense').reduce((s, e) => s + Number(e.amount), 0);
    const savings = entries.filter(e => e.type === 'savings').reduce((s, e) => s + Number(e.amount), 0);
    const net     = income - expense + savings;
    return { income, expense, savings, net };
  }, [entries]);

  const budgetUsed    = monthlyBudget > 0 ? Math.min((totals.expense / monthlyBudget) * 100, 100) : 0;
  const budgetRemaining = Math.max(monthlyBudget - totals.expense, 0);
  const budgetOverflow  = totals.expense > monthlyBudget && monthlyBudget > 0;

  const fmt = (n: number) =>
    new Intl.NumberFormat('en', { maximumFractionDigits: 0 }).format(n);

  const handleSaveBudget = () => {
    const val = parseFloat(budgetInput);
    if (!isNaN(val) && val > 0) onUpdateBudget(val);
    setEditingBudget(false);
    setBudgetInput('');
  };

  // ── Color logic ────────────────────────────────────────────────────────────
  const netPositive = totals.net >= 0;

  return (
    <Card className="overflow-hidden border-jood-gold-300/30 shadow-luxury" dir={dir}>
      {/* Ambient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-jood-teal-900/3 via-transparent to-jood-gold-500/3 pointer-events-none" />

      <CardContent className="p-6 relative">
        {/* ── Row 1: Three KPI chips ─────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {/* Net balance */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="col-span-1"
          >
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="w-4 h-4 text-jood-teal-700" />
              <span className="text-xs text-muted-foreground font-arabic">{t('wallet.net')} — {periodLabel}</span>
            </div>
            <div className={cn(
              'text-3xl font-black font-arabic leading-none',
              netPositive ? 'text-jood-teal-900' : 'text-destructive',
            )}>
              {netPositive ? '+' : ''}{fmt(totals.net)}
              <span className="text-sm font-normal text-muted-foreground mr-1">{currency}</span>
            </div>
          </motion.div>

          {/* Income */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.06 }}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-5 h-5 rounded-full bg-emerald-500/15 flex items-center justify-center">
                <TrendingUp className="w-3 h-3 text-emerald-600" />
              </div>
              <span className="text-xs text-muted-foreground font-arabic">{t('wallet.income')}</span>
            </div>
            <div className="text-xl font-bold font-arabic text-emerald-700">
              {fmt(totals.income)}
              <span className="text-xs font-normal text-muted-foreground mr-1">{currency}</span>
            </div>
          </motion.div>

          {/* Expenses */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.12 }}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-5 h-5 rounded-full bg-rose-500/15 flex items-center justify-center">
                <TrendingDown className="w-3 h-3 text-rose-600" />
              </div>
              <span className="text-xs text-muted-foreground font-arabic">{t('wallet.expenses')}</span>
            </div>
            <div className="text-xl font-bold font-arabic text-rose-700">
              {fmt(totals.expense)}
              <span className="text-xs font-normal text-muted-foreground mr-1">{currency}</span>
            </div>
          </motion.div>
        </div>

        {/* ── Row 2: Budget bar ──────────────────────────────────────────── */}
        <div className="border-t border-border/40 pt-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-jood-gold-600" />
              <span className="text-sm font-bold font-arabic text-foreground">{t('wallet.budget.title')}</span>
            </div>

            {/* Budget editor */}
            {editingBudget ? (
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  value={budgetInput}
                  onChange={e => setBudgetInput(e.target.value)}
                  placeholder={monthlyBudget ? String(monthlyBudget) : '٠'}
                  className="h-7 w-28 text-sm text-right font-arabic"
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveBudget(); if (e.key === 'Escape') setEditingBudget(false); }}
                  autoFocus
                />
                <span className="text-xs text-muted-foreground">{currency}</span>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600 hover:text-emerald-700" onClick={handleSaveBudget}>
                  <Check className="w-3.5 h-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => setEditingBudget(false)}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            ) : (
              <button
                onClick={() => { setEditingBudget(true); setBudgetInput(monthlyBudget ? String(monthlyBudget) : ''); }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-jood-teal-700 transition-colors font-arabic group"
              >
                {monthlyBudget > 0 ? `${fmt(monthlyBudget)} ${currency}` : t('wallet.budget.set')}
                <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            )}
          </div>

          {monthlyBudget > 0 ? (
            <>
              <div className="relative h-3 rounded-full overflow-hidden bg-muted/40">
                <motion.div
                  className={cn(
                    'h-full rounded-full',
                    budgetOverflow
                      ? 'bg-destructive'
                      : budgetUsed > 80
                      ? 'bg-gradient-to-r from-jood-gold-500 to-amber-600'
                      : 'bg-gradient-to-r from-jood-teal-700 to-jood-teal-900',
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${budgetUsed}%` }}
                  transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
              <div className="flex items-center justify-between mt-1.5 text-xs font-arabic">
                <span className={cn(
                  'font-bold',
                  budgetOverflow ? 'text-destructive' : budgetUsed > 80 ? 'text-amber-600' : 'text-jood-teal-700',
                )}>
                  {budgetUsed.toFixed(0)}% {t('wallet.budget.used')}
                </span>
                <span className="text-muted-foreground">
                  {budgetOverflow
                    ? `${t('wallet.budget.overflow')} ${fmt(totals.expense - monthlyBudget)} ${currency}`
                    : `${t('wallet.budget.remaining')} ${fmt(budgetRemaining)} ${currency}`}
                </span>
              </div>

              {/* Inline tip */}
              {budgetOverflow && (
                <p className="mt-2 text-xs text-destructive/80 font-arabic bg-destructive/5 rounded-lg px-3 py-2 border border-destructive/20">
                  {t('wallet.budget.overflow.tip')}
                </p>
              )}
              {!budgetOverflow && budgetUsed > 80 && (
                <p className="mt-2 text-xs text-amber-700 font-arabic bg-amber-500/5 rounded-lg px-3 py-2 border border-amber-300/30">
                  {t('wallet.budget.warning.tip')} — {t('wallet.budget.remaining')} {fmt(budgetRemaining)} {currency}.
                </p>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2 mt-1">
              <div className="h-3 rounded-full bg-muted/40 flex-1" />
              <span className="text-xs text-muted-foreground font-arabic">
                {t('wallet.budget.hint')}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default WalletSummary;
