import React, { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sun, CloudSun, Cloud, Wallet, Sparkles, TrendingUp,
  CheckCircle2, Clock, Mic, Flame, ChevronRight, Moon,
  Target, Brain, Circle, Calendar,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile, useTasks, useFinancialData } from '@/hooks/useDatabase';
import { useLanguage } from '@/hooks/useLanguage';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { MorningBrief } from './MorningBrief';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Recommendation {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  cta_label: string | null;
  confidence: number | null;
  dismissed_at: string | null;
  created_at: string;
}

// Prayer key lookup — maps API key to i18n key
const PRAYER_KEYS: Record<string, string> = {
  Fajr: 'home.prayer.fajr', Dhuhr: 'home.prayer.dhuhr',
  Asr: 'home.prayer.asr', Maghrib: 'home.prayer.maghrib', Isha: 'home.prayer.isha',
};

interface HomeOverviewProps {
  onNavigate: (tab: string) => void;
}

export const HomeOverview: React.FC<HomeOverviewProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { tasks, loading: tasksLoading } = useTasks();
  const { financialData, loading: finLoading } = useFinancialData();

  const { t, lang } = useLanguage();
  const [weather, setWeather] = useState<{ temp: number; descKey: string; icon: React.ComponentType<any> } | null>(null);
  const [prayer, setPrayer] = useState<{ key: string; time: string; minutesTo: number } | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [todayEvents, setTodayEvents] = useState<any[]>([]);
  const [todayHabits, setTodayHabits] = useState<any[]>([]);
  const [completedHabitIds, setCompletedHabitIds] = useState<Set<string>>(new Set());

  const displayName = profile?.display_name?.split(' ')[0]
    ?? user?.email?.split('@')[0]
    ?? (lang === 'ar' ? 'صديقتي' : 'friend');

  // ── Weather (Riyadh) ─────────────────────────────────────────────────────
  useEffect(() => {
    fetch('https://api.open-meteo.com/v1/forecast?latitude=24.71&longitude=46.68&current=temperature_2m,weather_code&timezone=Asia/Riyadh')
      .then(r => r.json())
      .then(d => {
        const c = d?.current;
        if (!c) return;
        const code = c.weather_code;
        const icon = code < 3 ? Sun : code < 60 ? CloudSun : Cloud;
        const descKey = code < 3 ? 'home.weather.clear' : code < 60 ? 'home.weather.partly_cloudy' : 'home.weather.rainy';
        setWeather({ temp: Math.round(c.temperature_2m), descKey, icon });
      }).catch(() => {});
  }, []);

  // ── Next prayer ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('https://api.aladhan.com/v1/timingsByCity?city=Riyadh&country=SA&method=4')
      .then(r => r.json())
      .then(d => {
        const t = d?.data?.timings;
        if (!t) return;
        const prayers: [string, string][] = [
          ['Fajr', t.Fajr], ['Dhuhr', t.Dhuhr], ['Asr', t.Asr],
          ['Maghrib', t.Maghrib], ['Isha', t.Isha],
        ];
        const now = new Date();
        const nowMin = now.getHours() * 60 + now.getMinutes();
        const next = prayers.find(([, time]) => {
          const [h, m] = time.split(':').map(Number);
          return h * 60 + m > nowMin;
        }) ?? prayers[0];
        const [h, m] = next[1].split(':').map(Number);
        const diff = (h * 60 + m) - nowMin;
        setPrayer({ key: PRAYER_KEYS[next[0]] ?? 'home.prayer.fajr', time: next[1], minutesTo: diff > 0 ? diff : 1440 + diff });
      }).catch(() => {});
  }, []);

  // ── AI recommendations ──────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    (supabase as any).from('ai_recommendations')
      .select('*')
      .eq('user_id', user.id)
      .is('dismissed_at', null)
      .order('created_at', { ascending: false })
      .limit(3)
      .then(({ data }: { data: Recommendation[] | null }) => {
        setRecommendations(data ?? []);
      });
  }, [user?.id]);

  // ── Today stats ─────────────────────────────────────────────────────────
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const todayDayOfWeek = today.getDay(); // 0=Sun

  // ── Fetch today's events + habits ───────────────────────────────────────
  const fetchTodayData = async () => {
    if (!user?.id) return;

    // Fetch events for today
    const { data: evts } = await (supabase as any)
      .from('events')
      .select('id, title, starts_at, start_at, ends_at, end_at')
      .eq('user_id', user.id)
      .or(`starts_at.gte.${todayStr}T00:00:00,start_at.gte.${todayStr}T00:00:00`)
      .order('starts_at', { ascending: true })
      .limit(5);

    const todayEvts = (evts || []).filter((e: any) => {
      const d = (e.starts_at || e.start_at || '').split('T')[0];
      return d === todayStr;
    });
    setTodayEvents(todayEvts.slice(0, 3));

    // Fetch active habits that occur today
    const { data: habits } = await (supabase as any)
      .from('habits')
      .select('id, title, time_of_day, target_days')
      .eq('user_id', user.id)
      .neq('is_active', false);

    const todayH = (habits || []).filter((h: any) => {
      if (!h.target_days || h.target_days.length === 0) return true; // daily
      return h.target_days.includes(todayDayOfWeek);
    });
    setTodayHabits(todayH.slice(0, 4));

    // Check which habits are completed today
    if (todayH.length > 0) {
      const { data: logs } = await (supabase as any)
        .from('habit_logs')
        .select('habit_id')
        .eq('user_id', user.id)
        .or(`date.eq.${todayStr},completed_date.eq.${todayStr}`);
      setCompletedHabitIds(new Set((logs || []).map((l: any) => l.habit_id)));
    }
  };

  useEffect(() => {
    fetchTodayData();
  }, [user?.id]);

  // ── Realtime: events + habit_logs ────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    const channel = (supabase as any)
      .channel(`today-glance-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `user_id=eq.${user.id}` }, fetchTodayData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'habit_logs', filter: `user_id=eq.${user.id}` }, fetchTodayData)
      .subscribe();
    return () => { (supabase as any).removeChannel(channel); };
  }, [user?.id]);

  // ── Toggle habit completion ──────────────────────────────────────────────
  const toggleHabit = async (habitId: string) => {
    if (!user?.id) return;
    const isCompleted = completedHabitIds.has(habitId);
    if (isCompleted) {
      await (supabase as any).from('habit_logs')
        .delete()
        .eq('user_id', user.id)
        .eq('habit_id', habitId)
        .or(`date.eq.${todayStr},completed_date.eq.${todayStr}`);
      setCompletedHabitIds(prev => { const n = new Set(prev); n.delete(habitId); return n; });
    } else {
      await (supabase as any).from('habit_logs')
        .insert({ user_id: user.id, habit_id: habitId, date: todayStr, completed_date: todayStr, completed: true });
      setCompletedHabitIds(prev => new Set([...prev, habitId]));
    }
  };

  const todayTasks = useMemo(
    () => tasks
      .filter(t => t.status === 'pending')
      .sort((a, b) => {
        const ad = a.due_date ? new Date(a.due_date).getTime() : Infinity;
        const bd = b.due_date ? new Date(b.due_date).getTime() : Infinity;
        return ad - bd;
      })
      .slice(0, 3),
    [tasks],
  );

  const walletSummary = useMemo(() => {
    const now = new Date();
    const thisMonth = financialData.filter(f => new Date(f.created_at).getMonth() === now.getMonth());
    const income = thisMonth.filter(f => f.type === 'income').reduce((s, f) => s + f.amount, 0);
    const expenses = thisMonth.filter(f => f.type === 'expense').reduce((s, f) => s + f.amount, 0);
    const balance = income - expenses;
    const recent = financialData
      .filter(f => f.type === 'expense')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
    return { balance, income, expenses, recent };
  }, [financialData]);

  const dismissRecommendation = async (id: string) => {
    await (supabase as any).from('ai_recommendations')
      .update({ dismissed_at: new Date().toISOString() })
      .eq('id', id);
    setRecommendations(r => r.filter(x => x.id !== id));
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat('en', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(n);

  const WeatherIcon = weather?.icon ?? Sun;

  return (
    <div className="space-y-5 max-w-4xl mx-auto">

      {/* ── Morning Brief (memory-driven hero) ────────────────────────────── */}
      <MorningBrief onActionClick={() => onNavigate('chat')} />

      {/* ── Greeting card (Slide 4) ────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <Card className="jood-card overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-jood-teal-900/90 via-jood-teal-700 to-jood-teal-900 pointer-events-none" />
          <CardContent className="relative p-6 text-white">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <motion.div
                animate={{ scale: [1, 1.012, 1] }}
                transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
                className="w-14 h-14 rounded-full bg-gradient-to-br from-jood-gold-500 to-jood-gold-300 flex items-center justify-center shadow-gold flex-shrink-0"
              >
                <span className="text-xl font-display text-jood-teal-900">ج</span>
              </motion.div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-jood-gold-300/90 font-arabic mb-0.5">{(() => { const h = new Date().getHours(); return h < 5 || h >= 20 ? t('home.greeting.evening') : h < 12 ? t('home.greeting.morning') : h < 17 ? t('home.greeting.afternoon') : t('home.greeting.evening'); })()}</p>
                <h2 className="text-xl md:text-2xl font-bold font-arabic leading-tight">
                  {lang === 'ar' ? `أهلاً ${displayName}!` : `Hello ${displayName}!`}
                </h2>
                <p className="text-xs text-white/70 font-arabic mt-1">{t('home.daily.summary')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Daily Briefing row (weather + prayer) ───────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.4 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        {/* Weather */}
        <Card className="jood-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-jood-gold-500/15 flex items-center justify-center flex-shrink-0">
              <WeatherIcon className="w-5 h-5 text-jood-gold-500" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-arabic">{t('home.weather.label')}</p>
              <p className="text-lg font-bold font-mono">{weather ? `${weather.temp}°C` : '—'}</p>
              <p className="text-[11px] text-muted-foreground font-arabic">{weather ? t(weather.descKey) : t('home.weather.loading')}</p>
            </div>
          </CardContent>
        </Card>

        {/* Next Prayer */}
        <Card className="jood-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-jood-teal-500/15 flex items-center justify-center flex-shrink-0">
              <Moon className="w-5 h-5 text-jood-teal-500" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground font-arabic">{t('home.prayer.next')}</p>
              <p className="text-lg font-bold font-arabic">{prayer ? t(prayer.key) : '—'}</p>
              <p className="text-[11px] text-muted-foreground font-mono">
                {prayer ? `${prayer.time} · ${lang === 'ar' ? `بعد ${Math.floor(prayer.minutesTo / 60)}س ${prayer.minutesTo % 60}د` : `in ${Math.floor(prayer.minutesTo / 60)}h ${prayer.minutesTo % 60}m`}` : ''}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Events today */}
        <Card className="jood-card">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-jood-teal-500/15 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-5 h-5 text-jood-teal-500" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-arabic">{t('home.tasks.today')}</p>
              <p className="text-lg font-bold font-mono">{todayTasks.length}</p>
              <p className="text-[11px] text-muted-foreground font-arabic">{t('home.tasks.pending')}</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Main row: Tasks + Wallet ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Today's Tasks */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
        >
          <Card className="jood-card h-full">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold font-arabic flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-jood-teal-500" />
                  مهام اليوم
                </h3>
                <Button
                  variant="ghost" size="sm"
                  onClick={() => onNavigate('planning')}
                  className="h-7 text-[11px] font-arabic text-muted-foreground hover:text-foreground"
                >
                  عرض الكل <ChevronRight className="w-3 h-3 mr-0.5 rotate-180" />
                </Button>
              </div>

              {tasksLoading ? (
                <div className="space-y-2 animate-pulse">
                  {[1, 2].map(i => <div key={i} className="h-9 bg-muted/40 rounded-xl" />)}
                </div>
              ) : todayTasks.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-xs text-muted-foreground font-arabic">لا مهام معلّقة — استمتعي بيومك!</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {todayTasks.map(t => (
                    <div key={t.id} className="flex items-center gap-2.5 p-2 rounded-xl bg-muted/30">
                      <div className={cn(
                        'w-2 h-2 rounded-full flex-shrink-0',
                        t.priority === 'high' ? 'bg-destructive'
                          : t.priority === 'medium' ? 'bg-jood-gold-500'
                            : 'bg-jood-teal-500',
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-arabic truncate">{t.title}</p>
                        {t.due_date && (
                          <p className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {new Date(t.due_date).toLocaleDateString('ar-SA', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Wallet Summary */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <Card className="jood-card h-full">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold font-arabic flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-jood-gold-500" />
                  محفظتي
                </h3>
                <Button
                  variant="ghost" size="sm"
                  onClick={() => onNavigate('financial')}
                  className="h-7 text-[11px] font-arabic text-muted-foreground hover:text-foreground"
                >
                  التفاصيل <ChevronRight className="w-3 h-3 mr-0.5 rotate-180" />
                </Button>
              </div>

              {finLoading ? (
                <div className="space-y-2 animate-pulse">
                  <div className="h-4 bg-muted/40 rounded w-1/2" />
                  <div className="h-8 bg-muted/40 rounded w-2/3" />
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/30">
                    <div className="h-6 bg-muted/30 rounded" />
                    <div className="h-6 bg-muted/30 rounded" />
                  </div>
                </div>
              ) : (
              <>
              <div>
                <p className="text-[10px] text-muted-foreground font-arabic">الرصيد الصافي هذا الشهر</p>
                <p className={cn(
                  'text-2xl font-bold font-mono mt-0.5',
                  walletSummary.balance >= 0 ? 'text-jood-ok' : 'text-destructive',
                )}>
                  {fmt(walletSummary.balance)}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/30">
                <div>
                  <p className="text-[10px] text-muted-foreground font-arabic">الدخل</p>
                  <p className="text-sm font-bold font-mono text-jood-teal-500">{fmt(walletSummary.income)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-arabic">المصروفات</p>
                  <p className="text-sm font-bold font-mono text-jood-gold-500">{fmt(walletSummary.expenses)}</p>
                </div>
              </div>

              {walletSummary.recent && (
                <div className="p-2 rounded-xl bg-muted/30 flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-muted-foreground font-arabic">آخر مصروف</p>
                    <p className="text-xs font-arabic truncate">{walletSummary.recent.label} · {fmt(walletSummary.recent.amount)}</p>
                  </div>
                </div>
              )}
              </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ── Today at a Glance: Events + Habits ─────────────────────────────── */}
      {(todayEvents.length > 0 || todayHabits.length > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22, duration: 0.4 }}
        >
          <Card className="jood-card">
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-bold font-arabic flex items-center gap-2">
                <Flame className="w-4 h-4 text-jood-gold-500" />
                اليوم دفعة واحدة
              </h3>

              {/* Events */}
              {todayEvents.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-muted-foreground font-arabic uppercase tracking-wide">المواعيد</p>
                  {todayEvents.map(ev => {
                    const startRaw = ev.starts_at || ev.start_at || '';
                    const timeStr = startRaw
                      ? new Date(startRaw).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
                      : '';
                    return (
                      <div key={ev.id} className="flex items-center gap-2.5 p-2 rounded-xl bg-muted/30">
                        <Calendar className="w-3.5 h-3.5 text-jood-teal-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-arabic truncate">{ev.title}</p>
                        </div>
                        {timeStr && (
                          <span className="text-[10px] text-muted-foreground font-mono flex-shrink-0">{timeStr}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Habits */}
              {todayHabits.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-muted-foreground font-arabic uppercase tracking-wide">العادات</p>
                  {todayHabits.map(h => {
                    const done = completedHabitIds.has(h.id);
                    return (
                      <button
                        key={h.id}
                        onClick={() => toggleHabit(h.id)}
                        className="w-full flex items-center gap-2.5 p-2 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors text-right"
                      >
                        {done
                          ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                          : <Circle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        }
                        <div className="flex-1 min-w-0">
                          <p className={cn('text-xs font-arabic truncate', done && 'line-through text-muted-foreground')}>
                            {h.title}
                          </p>
                        </div>
                        {h.time_of_day && (
                          <span className="text-[10px] text-muted-foreground font-arabic flex-shrink-0">{h.time_of_day}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── AI Recommendations (Slide 12) ───────────────────────────────────── */}
      {recommendations.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          className="space-y-2"
        >
          <h3 className="text-sm font-bold font-arabic flex items-center gap-2 px-1">
            <Brain className="w-4 h-4 text-jood-gold-500" />
            نصائح جود
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {recommendations.map((rec, i) => (
              <motion.div
                key={rec.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + i * 0.06 }}
              >
                <Card className="jood-card h-full border-jood-gold-500/25">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="w-8 h-8 rounded-lg bg-jood-gold-500/15 flex items-center justify-center flex-shrink-0">
                        <Sparkles className="w-4 h-4 text-jood-gold-500" />
                      </div>
                      {rec.confidence != null && (
                        <Badge variant="outline" className="text-[9px] h-5 font-mono border-jood-gold-500/30 text-jood-gold-500">
                          {Math.round(rec.confidence * 100)}%
                        </Badge>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-bold font-arabic leading-snug">{rec.title}</p>
                      {rec.body && (
                        <p className="text-xs text-muted-foreground font-arabic mt-1 leading-relaxed line-clamp-2">
                          {rec.body}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1.5 pt-1">
                      <Button
                        size="sm"
                        className="h-7 text-[11px] jood-btn-primary flex-1"
                        onClick={() => onNavigate('chat')}
                      >
                        {rec.cta_label ?? 'اتخذ إجراء'}
                      </Button>
                      <Button
                        size="sm" variant="ghost"
                        className="h-7 text-[11px] font-arabic text-muted-foreground hover:text-destructive"
                        onClick={() => dismissRecommendation(rec.id)}
                      >
                        تجاهل
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Quick Actions chips ──────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.32, duration: 0.4 }}
      >
        <h3 className="text-sm font-bold font-arabic mb-2 px-1">اختصارات سريعة</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: Mic,       label: 'جلسة صوتية',     hint: 'المجلس',     tab: 'chat',       gold: true  },
            { icon: Flame,     label: 'تسجيل عادة',     hint: 'اليوم',      tab: 'planning',   gold: false },
            { icon: Target,    label: 'تتبع الميزانية', hint: 'الشهر',      tab: 'financial',  gold: true  },
            { icon: Sparkles,  label: 'محادثة جديدة',   hint: 'مع جود',     tab: 'chat',       gold: false },
          ].map(({ icon: Icon, label, hint, tab, gold }, i) => (
            <button
              key={i}
              onClick={() => onNavigate(tab)}
              className={cn(
                'jood-card p-4 text-right transition-all duration-200 hover:shadow-elegant group',
                gold ? 'hover:border-jood-gold-500/40' : 'hover:border-jood-teal-500/40',
              )}
            >
              <div className={cn(
                'w-9 h-9 rounded-xl flex items-center justify-center mb-2 transition-colors',
                gold ? 'bg-jood-gold-500/15 text-jood-gold-500 group-hover:bg-jood-gold-500/25'
                     : 'bg-jood-teal-500/15 text-jood-teal-500 group-hover:bg-jood-teal-500/25',
              )}>
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-sm font-bold font-arabic">{label}</p>
              <p className="text-[10px] text-muted-foreground font-arabic">{hint}</p>
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
};
