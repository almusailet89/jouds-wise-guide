import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Wallet, CalendarClock, Target, TrendingUp, Plus, Sparkles, Loader2,
} from 'lucide-react';
import { useProfile, useFinancialData, useGoals } from '@/hooks/useDatabase';
import { normalizeNumerals } from '@/lib/utils';
import { useLanguage } from '@/hooks/useLanguage';
import { cn } from '@/lib/utils';

// ─── Utility: days until next salary ─────────────────────────────────────────
const daysUntilSalary = (payday = 25): { days: number; nextDate: Date } => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  let next = new Date(y, m, payday);
  if (next <= now) next = new Date(y, m + 1, payday);
  const diff = Math.ceil((next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return { days: diff, nextDate: next };
};


// ─── Goal colour palette ──────────────────────────────────────────────────────
const GOAL_COLORS = [
  'from-jood-gold-500 to-jood-gold-700',
  'from-jood-teal-700 to-jood-teal-900',
  'from-indigo-500 to-indigo-700',
  'from-rose-500 to-rose-700',
  'from-emerald-500 to-emerald-700',
  'from-violet-500 to-violet-700',
];

// ═══════════════════════════════════════════════════════════════════════════════
export const FinanceExtras: React.FC = () => {
  const { profile } = useProfile();
  const { financialData } = useFinancialData();
  const { goals, loading: goalsLoading, updateGoal } = useGoals();
  const { t, tg, lang, dir } = useLanguage();

  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [addAmount, setAddAmount]         = useState('');
  const [saving, setSaving]               = useState(false);

  // ── Salary countdown ──────────────────────────────────────────────────────
  const { days, nextDate } = daysUntilSalary(25);
  const salary = profile?.income ?? 0;

  // ── Current net savings ───────────────────────────────────────────────────
  const currentSavings = useMemo(() => {
    const income  = financialData.filter(f => f.type === 'income') .reduce((s, f) => s + Number(f.amount), 0);
    const expense = financialData.filter(f => f.type === 'expense').reduce((s, f) => s + Number(f.amount), 0);
    return Math.max(income - expense, 0);
  }, [financialData]);


  // ── Add to goal ───────────────────────────────────────────────────────────
  const addToGoal = async () => {
    if (!editingGoalId) return;
    const amt = Number(addAmount);
    if (!amt || amt <= 0) return;
    setSaving(true);
    const goal = goals.find(g => g.id === editingGoalId);
    if (goal) {
      const newSaved = Number(goal.saved_amount) + amt;
      const newStatus = newSaved >= Number(goal.target_amount) ? 'completed' : 'active';
      await updateGoal(editingGoalId, { saved_amount: newSaved, status: newStatus as any });
    }
    setSaving(false);
    setEditingGoalId(null);
    setAddAmount('');
  };

  const fmt = (n: number) => new Intl.NumberFormat(lang === 'ar' ? 'ar-SA' : 'en-US').format(Math.round(n));
  const editingGoal = goals.find(g => g.id === editingGoalId);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

      {/* ── 1. Salary Countdown ──────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }}>
        <Card className="h-full overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-jood-teal-900/5 via-jood-teal-700/5 to-transparent" />
          <CardContent className="p-5 relative">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-jood-teal-900 to-jood-teal-700 flex items-center justify-center">
                  <CalendarClock className="w-4.5 h-4.5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-sm font-arabic">{t('fin.salary.title')}</h3>
                  <p className="text-[10px] text-muted-foreground font-arabic">
                    {nextDate.toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', { day: 'numeric', month: 'long' })}
                  </p>
                </div>
              </div>
              <Badge className="bg-jood-gold-500/20 text-jood-gold-700 border-0 font-arabic text-[10px]">
                {days <= 3 ? t('fin.salary.soon') : days <= 10 ? t('fin.salary.coming') : '📅'}
              </Badge>
            </div>

            <div className="mb-2">
              <div className="text-4xl font-black font-arabic text-jood-teal-900 leading-none">{days}</div>
              <div className="text-xs text-muted-foreground font-arabic mt-1">
                {lang === 'ar'
                  ? (days === 1 ? 'يوم' : days === 2 ? 'يومان' : days <= 10 ? 'أيام' : 'يوماً') + ' متبقية'
                  : t('fin.salary.days')
                }
              </div>
            </div>

            {salary > 0 ? (
              <div className="pt-3 mt-3 border-t border-border/40">
                <div className="flex justify-between items-center text-xs font-arabic">
                  <span className="text-muted-foreground">{t('fin.salary.expected')}</span>
                  <span className="font-mono font-bold text-jood-teal-700">{fmt(salary)} {t('fin.salary.sar')}</span>
                </div>
                <div className="flex justify-between items-center text-[10px] font-arabic mt-1 text-muted-foreground">
                  <span>{t('fin.salary.daily')}</span>
                  <span className="font-mono">{fmt(Math.round(salary / 30))} {t('fin.salary.sar')}</span>
                </div>
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground font-arabic mt-2 italic">
                {tg('fin.salary.no.income')}
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ── 2. Savings Goals (live from DB) ──────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
        <Card className="h-full">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-jood-gold-500 to-jood-gold-700 flex items-center justify-center">
                  <Target className="w-4.5 h-4.5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-sm font-arabic">{t('fin.goals.title')}</h3>
                  <p className="text-[10px] text-muted-foreground font-arabic">
                    {goalsLoading
                      ? '…'
                      : `${goals.filter(g => g.status === 'completed').length} ${t('fin.goals.of')} ${goals.length} ${t('fin.goals.completed')}`
                    }
                  </p>
                </div>
              </div>
            </div>

            {goalsLoading ? (
              <div className="flex items-center justify-center h-24">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : goals.length === 0 ? (
              <div className="text-center py-6">
                <Target className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground font-arabic">
                  {t('fin.goals.empty')}
                </p>
                <p className="text-[10px] text-muted-foreground/60 font-arabic mt-1">
                  {tg('fin.goals.empty.hint')}
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[200px] overflow-y-auto pr-1">
                {goals.map((g, idx) => {
                  const saved  = Number(g.saved_amount);
                  const target = Number(g.target_amount);
                  const pct    = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0;
                  const color  = GOAL_COLORS[idx % GOAL_COLORS.length];
                  return (
                    <div key={g.id} className="group">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <div className={cn('w-6 h-6 rounded-lg bg-gradient-to-br flex items-center justify-center text-[11px]', color)}>
                            {g.icon ?? '🎯'}
                          </div>
                          <span className="text-[11px] font-arabic font-semibold truncate max-w-[110px]">{g.title}</span>
                          {g.status === 'completed' && <span className="text-[9px]">🎉</span>}
                        </div>
                        <button
                          onClick={() => setEditingGoalId(g.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Plus className="w-3 h-3 text-jood-teal-700" />
                        </button>
                      </div>
                      <div className="relative h-1.5 bg-muted/40 rounded-full overflow-hidden">
                        <motion.div
                          className={cn('h-full bg-gradient-to-r', color)}
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                        />
                      </div>
                      <div className="flex justify-between text-[9px] font-arabic mt-0.5 text-muted-foreground">
                        <span className="font-mono">{fmt(saved)}</span>
                        <span>{pct}%</span>
                        <span className="font-mono">{fmt(target)} {t('fin.salary.sar')}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Add-to-goal dialog ────────────────────────────────────────────────── */}
      <Dialog open={!!editingGoalId} onOpenChange={v => !v && setEditingGoalId(null)}>
        <DialogContent className="max-w-sm" dir={dir}>
          <DialogHeader>
            <DialogTitle className="font-arabic">
              {tg('fin.goals.add.title')} — «{editingGoal?.title ?? ''}»
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="font-arabic text-xs">{t('fin.goals.add.label')}</Label>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="500"
              value={addAmount}
              onChange={e => setAddAmount(normalizeNumerals(e.target.value))}
              onKeyDown={e => e.key === 'Enter' && addToGoal()}
              className="text-sm"
              autoFocus
            />
            {editingGoal && (
              <p className="text-[10px] text-muted-foreground font-arabic">
                {t('fin.goals.saved')} {fmt(Number(editingGoal.saved_amount))} {t('fin.salary.sar')}
                {' '}/{' '}
                {fmt(Number(editingGoal.target_amount))} {t('fin.salary.sar')}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingGoalId(null)} className="font-arabic">{t('fin.goals.cancel')}</Button>
            <Button onClick={addToGoal} disabled={saving} className="bg-jood-gold-500 hover:bg-jood-gold-700 text-white font-arabic">
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : t('fin.goals.add.btn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FinanceExtras;
