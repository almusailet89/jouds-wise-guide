import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Wallet, CalendarClock, Target, TrendingUp, Plus, Flame,
  Car, Home, Shield, Plane, Sparkles, ArrowUpRight,
} from 'lucide-react';
import { useProfile, useFinancialData } from '@/hooks/useDatabase';
import { cn } from '@/lib/utils';

// ─── Utility: days until next salary (25th of current or next month) ─────────
const daysUntilSalary = (payday = 25): { days: number; nextDate: Date } => {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  let next = new Date(y, m, payday);
  if (next <= now) next = new Date(y, m + 1, payday);
  const diff = Math.ceil((next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return { days: diff, nextDate: next };
};

// ─── Savings goal presets ─────────────────────────────────────────────────────
interface Goal {
  id: string;
  name: string;
  icon: React.ComponentType<any>;
  target: number;
  saved: number;
  color: string;
}

const DEFAULT_GOALS: Goal[] = [
  { id: 'emergency', name: 'صندوق الطوارئ',  icon: Shield, target: 20000, saved: 0, color: 'from-emerald-500 to-emerald-700' },
  { id: 'car',       name: 'سيارة جديدة',    icon: Car,    target: 60000, saved: 0, color: 'from-jood-gold-500 to-jood-gold-700' },
  { id: 'travel',    name: 'رحلة العمرة',    icon: Plane,  target: 8000,  saved: 0, color: 'from-indigo-500 to-indigo-700' },
  { id: 'home',      name: 'دفعة السكن',     icon: Home,   target: 100000, saved: 0, color: 'from-rose-500 to-rose-700' },
];

// ─── Investment scenario projections ──────────────────────────────────────────
// Monthly compounding with realistic Saudi-market ranges
const projectGrowth = (principal: number, monthlyDeposit: number, annualRate: number, years: number) => {
  const r = annualRate / 12;
  const n = years * 12;
  const fv = principal * Math.pow(1 + r, n) + monthlyDeposit * ((Math.pow(1 + r, n) - 1) / r);
  return Math.round(fv);
};

const SCENARIOS = [
  { label: 'حذر',      rate: 0.04, color: 'text-slate-600',     tag: 'صكوك' },
  { label: 'متوازن',   rate: 0.08, color: 'text-jood-teal-700', tag: 'مؤشر تاسي' },
  { label: 'نشط',      rate: 0.12, color: 'text-jood-gold-700', tag: 'أسهم نامية' },
];

// ═══════════════════════════════════════════════════════════════════════════════
export const FinanceExtras: React.FC = () => {
  const { profile } = useProfile();
  const { financialData } = useFinancialData();

  const [goals, setGoals] = useState<Goal[]>(DEFAULT_GOALS);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [addAmount, setAddAmount] = useState('');

  // ── Salary countdown ─────────────────────────────────────────────────────────
  const { days, nextDate } = daysUntilSalary(25);
  const salary = profile?.income ?? 0;

  // ── Current savings = positive balance (income - expense) ───────────────────
  const currentSavings = useMemo(() => {
    const income = financialData.filter(f => f.type === 'income').reduce((s, f) => s + Number(f.amount), 0);
    const expense = financialData.filter(f => f.type === 'expense').reduce((s, f) => s + Number(f.amount), 0);
    return Math.max(income - expense, 0);
  }, [financialData]);

  // Auto-allocate current savings to emergency-fund by default
  const displayGoals = useMemo(() => {
    return goals.map((g, i) => ({
      ...g,
      saved: i === 0 ? Math.min(currentSavings, g.target) : g.saved,
    }));
  }, [goals, currentSavings]);

  // ── Investment projection ────────────────────────────────────────────────────
  const monthlyDeposit = Math.max(Math.round(salary * 0.2), 500); // assume 20% of salary
  const projections5 = SCENARIOS.map(s => ({
    ...s,
    fv: projectGrowth(currentSavings, monthlyDeposit, s.rate, 5),
  }));

  // ── Add to goal ──────────────────────────────────────────────────────────────
  const addToGoal = () => {
    if (!editingGoalId) return;
    const amt = Number(addAmount);
    if (!amt || amt <= 0) return;
    setGoals(prev => prev.map(g => g.id === editingGoalId ? { ...g, saved: g.saved + amt } : g));
    setEditingGoalId(null);
    setAddAmount('');
  };

  const fmt = (n: number) => new Intl.NumberFormat('ar-SA').format(n);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* ── 1. Salary Countdown ────────────────────────────────────────────── */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
      >
        <Card className="h-full overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-jood-teal-900/5 via-jood-teal-700/5 to-transparent" />
          <CardContent className="p-5 relative">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-jood-teal-900 to-jood-teal-700 flex items-center justify-center">
                  <CalendarClock className="w-4.5 h-4.5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-sm font-arabic">الراتب القادم</h3>
                  <p className="text-[10px] text-muted-foreground font-arabic">
                    {nextDate.toLocaleDateString('ar-SA', { day: 'numeric', month: 'long' })}
                  </p>
                </div>
              </div>
              <Badge className="bg-jood-gold-500/20 text-jood-gold-700 border-0 font-arabic text-[10px]">
                {days <= 3 ? '🔥 قريب' : days <= 10 ? '⏰ قريباً' : '📅'}
              </Badge>
            </div>

            <div className="mb-2">
              <div className="text-4xl font-black font-arabic text-jood-teal-900 leading-none">
                {days}
              </div>
              <div className="text-xs text-muted-foreground font-arabic mt-1">
                {days === 1 ? 'يوم' : days === 2 ? 'يومان' : days <= 10 ? 'أيام' : 'يوماً'} متبقية
              </div>
            </div>

            {salary > 0 && (
              <div className="pt-3 mt-3 border-t border-border/40">
                <div className="flex justify-between items-center text-xs font-arabic">
                  <span className="text-muted-foreground">المتوقع</span>
                  <span className="font-mono font-bold text-jood-teal-700">
                    {fmt(salary)} ر.س
                  </span>
                </div>
                <div className="flex justify-between items-center text-[10px] font-arabic mt-1 text-muted-foreground">
                  <span>يومياً ≈</span>
                  <span className="font-mono">{fmt(Math.round(salary / 30))} ر.س</span>
                </div>
              </div>
            )}

            {salary === 0 && (
              <p className="text-[10px] text-muted-foreground font-arabic mt-2 italic">
                عدّلي دخلك في الملف الشخصي لرؤية التوقعات
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* ── 2. Savings Goals ───────────────────────────────────────────────── */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Card className="h-full">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-jood-gold-500 to-jood-gold-700 flex items-center justify-center">
                  <Target className="w-4.5 h-4.5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-sm font-arabic">أهداف الادخار</h3>
                  <p className="text-[10px] text-muted-foreground font-arabic">
                    {displayGoals.filter(g => g.saved >= g.target).length} من {displayGoals.length} مكتمل
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2.5 max-h-[200px] overflow-y-auto pr-1">
              {displayGoals.map(g => {
                const pct = Math.min(100, Math.round((g.saved / g.target) * 100));
                const Icon = g.icon;
                return (
                  <div key={g.id} className="group">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <div className={cn(
                          'w-6 h-6 rounded-lg bg-gradient-to-br flex items-center justify-center',
                          g.color,
                        )}>
                          <Icon className="w-3 h-3 text-white" />
                        </div>
                        <span className="text-[11px] font-arabic font-semibold">{g.name}</span>
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
                        className={cn('h-full bg-gradient-to-r', g.color)}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                      />
                    </div>
                    <div className="flex justify-between text-[9px] font-arabic mt-0.5 text-muted-foreground">
                      <span className="font-mono">{fmt(g.saved)}</span>
                      <span>{pct}%</span>
                      <span className="font-mono">{fmt(g.target)} ر.س</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* ── 3. Investment Projection (AI) ──────────────────────────────────── */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
      >
        <Card className="h-full overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-jood-gold-500/10 via-transparent to-jood-teal-700/5" />
          <CardContent className="p-5 relative">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-jood-gold-500 to-amber-700 flex items-center justify-center">
                  <TrendingUp className="w-4.5 h-4.5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-sm font-arabic flex items-center gap-1">
                    توقعات جود <Sparkles className="w-3 h-3 text-jood-gold-500" />
                  </h3>
                  <p className="text-[10px] text-muted-foreground font-arabic">
                    بعد ٥ سنوات • إيداع {fmt(monthlyDeposit)} ر.س/شهر
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {projections5.map((p, i) => (
                <motion.div
                  key={p.label}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.2 + i * 0.08 }}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors"
                >
                  <div>
                    <div className={cn('text-xs font-bold font-arabic', p.color)}>
                      {p.label}
                    </div>
                    <div className="text-[9px] text-muted-foreground font-arabic">
                      {p.tag} • {Math.round(p.rate * 100)}٪ سنوياً
                    </div>
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-black font-mono text-foreground">
                      {fmt(p.fv)}
                    </div>
                    <div className="text-[9px] text-jood-teal-700 font-arabic flex items-center gap-0.5 justify-end">
                      <ArrowUpRight className="w-2.5 h-2.5" />
                      ر.س
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <p className="text-[9px] text-muted-foreground font-arabic mt-3 italic leading-relaxed">
              * توقعات تقديرية — النتائج الفعلية تتفاوت. اطلبي استشارة مالية قبل أي قرار.
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Add-to-goal dialog ────────────────────────────────────────────── */}
      <Dialog open={!!editingGoalId} onOpenChange={v => !v && setEditingGoalId(null)}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="font-arabic">
              أضيفي لـ {displayGoals.find(g => g.id === editingGoalId)?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="font-arabic text-xs">المبلغ (ر.س)</Label>
            <Input
              type="number"
              placeholder="500"
              value={addAmount}
              onChange={e => setAddAmount(e.target.value)}
              className="text-sm"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingGoalId(null)} className="font-arabic">إلغاء</Button>
            <Button onClick={addToGoal} className="bg-jood-gold-500 hover:bg-jood-gold-700 text-white font-arabic">
              إضافة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FinanceExtras;
