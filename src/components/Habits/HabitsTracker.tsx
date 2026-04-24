import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Plus, Flame, Check, X, Loader2, Target,
  Calendar, Trophy, Trash2, ChevronDown,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Habit {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  frequency: string;
  target_days: number[] | null;
  color: string | null;
  icon: string | null;
  is_active: boolean;
  created_at: string;
  streak?: number;
  completedToday?: boolean;
}

interface HabitLog {
  id: string;
  habit_id: string;
  completed_date: string;
  note: string | null;
}

// ─── Color palette ────────────────────────────────────────────────────────────
const COLORS = ['#0E4E4E', '#1a7a7a', '#B8924A', '#d4a853', '#10b981', '#6366f1', '#f43f5e', '#8b5cf6'];
const ICONS  = ['⭐', '💪', '📖', '🏃', '🥗', '💧', '🧘', '🤲', '💊', '🌙'];

const DAYS_AR = ['أحد', 'إثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت'];

// ─── Mini heatmap for last 35 days ───────────────────────────────────────────
const HeatmapDots: React.FC<{ logs: HabitLog[]; habitId: string }> = ({ logs, habitId }) => {
  const today = new Date();
  const cells = Array.from({ length: 35 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (34 - i));
    const dateStr = d.toISOString().split('T')[0];
    const done = logs.some(l => l.habit_id === habitId && l.completed_date === dateStr);
    return { dateStr, done };
  });

  return (
    <div className="flex gap-0.5">
      {cells.map(({ dateStr, done }) => (
        <div
          key={dateStr}
          title={dateStr}
          className={cn(
            'w-2 h-2 rounded-sm transition-colors',
            done ? 'bg-jood-teal-500' : 'bg-muted/50',
          )}
        />
      ))}
    </div>
  );
};

// ─── Single habit row ─────────────────────────────────────────────────────────
interface HabitRowProps {
  habit: Habit;
  logs: HabitLog[];
  onToggle: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
}

const HabitRow: React.FC<HabitRowProps> = ({ habit, logs, onToggle, onDelete }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="jood-card p-3 space-y-2"
    >
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
          style={{ backgroundColor: (habit.color ?? '#0E4E4E') + '22' }}
        >
          {habit.icon ?? '⭐'}
        </div>

        {/* Name + streak */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold font-arabic truncate">{habit.name}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Flame className="w-3 h-3 text-jood-gold-500" />
            <span className="text-[11px] text-muted-foreground font-arabic">
              {habit.streak ?? 0} يوم متتالي
            </span>
          </div>
        </div>

        {/* Check button */}
        <button
          onClick={() => onToggle(habit.id, !habit.completedToday)}
          className={cn(
            'w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200',
            habit.completedToday
              ? 'bg-jood-teal-700 text-white shadow-elegant'
              : 'border-2 border-dashed border-border/60 text-transparent hover:border-jood-teal-500',
          )}
        >
          <Check className="w-4 h-4" />
        </button>

        {/* Expand */}
        <button
          onClick={() => setExpanded(v => !v)}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronDown className={cn('w-4 h-4 transition-transform', expanded && 'rotate-180')} />
        </button>
      </div>

      {/* Heatmap (expanded) */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-2 space-y-2 border-t border-border/30">
              <HeatmapDots logs={logs} habitId={habit.id} />
              <div className="flex items-center justify-between">
                {habit.description && (
                  <p className="text-xs text-muted-foreground font-arabic">{habit.description}</p>
                )}
                <button
                  onClick={() => onDelete(habit.id)}
                  className="ml-auto text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
const HabitsTracker: React.FC = () => {
  const { session } = useAuth();
  const { toast } = useToast();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // New habit form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [selectedIcon, setSelectedIcon] = useState(ICONS[0]);

  const todayStr = new Date().toISOString().split('T')[0];

  // ── Load data ────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!session?.user?.id) return;
    setLoading(true);
    try {
      const [habitsRes, logsRes] = await Promise.all([
        (supabase as any).from('habits').select('*').eq('user_id', session.user.id).eq('is_active', true).order('created_at'),
        (supabase as any).from('habit_logs').select('*').eq('user_id', session.user.id)
          .gte('completed_date', new Date(Date.now() - 35 * 86400000).toISOString().split('T')[0]),
      ]);

      const rawHabits: Habit[] = habitsRes.data ?? [];
      const rawLogs: HabitLog[] = logsRes.data ?? [];

      // Compute streak + completedToday
      const enriched = rawHabits.map(h => {
        const hLogs = rawLogs.filter(l => l.habit_id === h.id);
        const completedToday = hLogs.some(l => l.completed_date === todayStr);

        let streak = 0;
        const d = new Date();
        while (true) {
          const ds = d.toISOString().split('T')[0];
          if (hLogs.some(l => l.completed_date === ds)) {
            streak++;
            d.setDate(d.getDate() - 1);
          } else break;
        }

        return { ...h, streak, completedToday };
      });

      setHabits(enriched);
      setLogs(rawLogs);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id, todayStr]);

  useEffect(() => { load(); }, [load]);

  // ── Toggle completion ────────────────────────────────────────────────────
  const toggleHabit = async (habitId: string, markDone: boolean) => {
    if (!session?.user?.id) return;
    if (markDone) {
      const { error } = await (supabase as any).from('habit_logs').insert({
        habit_id: habitId,
        user_id: session.user.id,
        completed_date: todayStr,
      });
      if (error && !error.message.includes('duplicate')) {
        toast({ title: 'خطأ', description: error.message, variant: 'destructive' });
        return;
      }
    } else {
      await (supabase as any).from('habit_logs')
        .delete()
        .eq('habit_id', habitId)
        .eq('completed_date', todayStr);
    }
    await load();
  };

  // ── Add habit ────────────────────────────────────────────────────────────
  const addHabit = async () => {
    if (!name.trim() || !session?.user?.id) return;
    setSaving(true);
    try {
      const { error } = await (supabase as any).from('habits').insert({
        user_id: session.user.id,
        name: name.trim(),
        description: description.trim() || null,
        frequency: 'daily',
        color: selectedColor,
        icon: selectedIcon,
        is_active: true,
      });
      if (error) throw error;
      setName('');
      setDescription('');
      setShowForm(false);
      await load();
      toast({ title: 'تمت الإضافة', description: `عادة "${name.trim()}" تمت إضافتها.` });
    } catch (e: any) {
      toast({ title: 'خطأ', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ── Delete habit ─────────────────────────────────────────────────────────
  const deleteHabit = async (id: string) => {
    await (supabase as any).from('habits').update({ is_active: false }).eq('id', id);
    await load();
  };

  // ── Stats ─────────────────────────────────────────────────────────────────
  const completedToday = habits.filter(h => h.completedToday).length;
  const totalToday = habits.length;
  const maxStreak = Math.max(0, ...habits.map(h => h.streak ?? 0));
  const todayPct = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0;

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="jood-card">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold font-mono">{completedToday}/{totalToday}</p>
                <p className="text-xs text-muted-foreground font-arabic">مكتملة اليوم</p>
              </div>
              <Target className="w-7 h-7 text-jood-teal-500/60" />
            </div>
          </CardContent>
        </Card>
        <Card className="jood-card">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold font-mono">{todayPct}%</p>
                <p className="text-xs text-muted-foreground font-arabic">نسبة الإنجاز</p>
              </div>
              <Calendar className="w-7 h-7 text-jood-teal-500/60" />
            </div>
          </CardContent>
        </Card>
        <Card className="jood-card">
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold font-mono">{maxStreak}</p>
                <p className="text-xs text-muted-foreground font-arabic">أطول سلسلة</p>
              </div>
              <Trophy className="w-7 h-7 text-jood-gold-500/70" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today banner */}
      {totalToday > 0 && (
        <div className="jood-card p-3 flex items-center gap-3">
          <div className="flex-1">
            <p className="text-sm font-arabic font-semibold text-foreground">
              {DAYS_AR[new Date().getDay()]} ·{' '}
              {new Date().toLocaleDateString('ar-SA', { month: 'long', day: 'numeric' })}
            </p>
            <div className="w-full bg-muted rounded-full h-1.5 mt-1.5">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${todayPct}%` }}
                className="h-1.5 rounded-full bg-gradient-to-r from-jood-teal-700 to-jood-teal-500"
              />
            </div>
          </div>
          <Flame className="w-5 h-5 text-jood-gold-500 flex-shrink-0" />
        </div>
      )}

      {/* Habit list */}
      <Card className="jood-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-arabic">عاداتي اليومية</CardTitle>
            <Button
              size="sm"
              onClick={() => setShowForm(v => !v)}
              className="jood-btn-primary gap-1.5 h-8 text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              عادة جديدة
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-2.5">
          {/* New habit form */}
          <AnimatePresence>
            {showForm && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="p-4 rounded-2xl bg-muted/30 border border-border/40 space-y-3 mb-3">
                  <Input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="اسم العادة… مثل: قرأت القرآن"
                    className="font-arabic text-sm"
                    onKeyDown={e => e.key === 'Enter' && addHabit()}
                  />
                  <Input
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="وصف اختياري…"
                    className="font-arabic text-sm"
                  />

                  {/* Icon picker */}
                  <div>
                    <p className="text-[11px] text-muted-foreground font-arabic mb-1.5">الأيقونة</p>
                    <div className="flex gap-1.5 flex-wrap">
                      {ICONS.map(ic => (
                        <button
                          key={ic}
                          onClick={() => setSelectedIcon(ic)}
                          className={cn(
                            'w-8 h-8 rounded-lg text-base transition-all',
                            selectedIcon === ic ? 'ring-2 ring-jood-teal-500 bg-jood-teal-500/15 scale-110' : 'hover:bg-muted',
                          )}
                        >
                          {ic}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Color picker */}
                  <div>
                    <p className="text-[11px] text-muted-foreground font-arabic mb-1.5">اللون</p>
                    <div className="flex gap-1.5">
                      {COLORS.map(c => (
                        <button
                          key={c}
                          onClick={() => setSelectedColor(c)}
                          className={cn(
                            'w-6 h-6 rounded-full transition-all',
                            selectedColor === c && 'ring-2 ring-offset-1 ring-foreground/40 scale-110',
                          )}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button size="sm" onClick={addHabit} disabled={saving || !name.trim()} className="jood-btn-primary flex-1">
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      حفظ
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowForm(false)} className="flex-1">
                      <X className="w-3.5 h-3.5" />
                      إلغاء
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-jood-teal-500" />
            </div>
          ) : habits.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <p className="text-3xl">🌱</p>
              <p className="text-sm font-arabic text-muted-foreground">لا عادات بعد.</p>
              <p className="text-xs text-muted-foreground font-arabic">أضيفي أولى عاداتك اليومية الآن!</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {habits.map(h => (
                <HabitRow
                  key={h.id}
                  habit={h}
                  logs={logs}
                  onToggle={toggleHabit}
                  onDelete={deleteHabit}
                />
              ))}
            </AnimatePresence>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default HabitsTracker;
