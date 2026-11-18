import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Radio, Square, RefreshCw, Target, Lightbulb, Activity } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { useTimezone } from '@/hooks/useTimezone';
import { useDailyBrief } from '@/hooks/useDailyBrief';
import { useChat } from '@/hooks/useChat';
import { JoodOrb, type OrbMode } from '@/components/Voice/JoodOrb';
import { cn } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════════════════════
// JoodCommandCenter — "مركز القيادة"
//
// Jood's take on the J.A.R.V.I.S. command center: one screen that reads the
// user's real data (calendar, tasks, money, habits, memory), shows which
// sources actually answered, ranks the three things that matter today, and
// speaks the daily brief in Jood's Arabic voice (elevenlabs-tts via useChat).
//
// Honesty rules (same as the brief):
//   - A source that errors is shown OFFLINE — never filled with a guess.
//   - A source that answers with nothing is ONLINE with "nothing today".
//   - Priorities and "one thing to know" are computed from rows, not an LLM,
//     so the screen costs zero AI tokens until the user asks Jood to speak.
// ═══════════════════════════════════════════════════════════════════════════════

type SourceKey = 'calendar' | 'tasks' | 'finance' | 'habits' | 'memory';

interface SourceStatus {
  key: SourceKey;
  online: boolean | null; // null = still loading
  count: number;
  line: { ar: string; en: string };
}

interface TaskRow { title: string; due_date: string | null; priority: string | null; status: string | null }
interface EventRow { title: string; start_at: string }
interface FinanceRow { type: string; amount: number; category: string | null; created_at: string }

interface Priority { title: string; why: { ar: string; en: string } }

interface Props {
  /** Opens the full live voice conversation (Majlis mode) */
  onOpenMajlis?: () => void;
  onNavigate?: (tab: string) => void;
}

const SOURCE_LABEL: Record<SourceKey, { ar: string; en: string }> = {
  calendar: { ar: 'التقويم',  en: 'Calendar' },
  tasks:    { ar: 'المهام',   en: 'Tasks' },
  finance:  { ar: 'المالية',  en: 'Finance' },
  habits:   { ar: 'العادات',  en: 'Habits' },
  memory:   { ar: 'الذاكرة',  en: 'Memory' },
};

const PRIORITY_WEIGHT: Record<string, number> = { high: 3, medium: 2, low: 1 };

const daysBetween = (fromIso: string, toIso: string) =>
  Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 86_400_000);

// Rank open tasks: overdue first (oldest first), then due today, then by priority.
function rankPriorities(tasks: TaskRow[], today: string): Priority[] {
  const scored = tasks.map(t => {
    const overdueDays = t.due_date && t.due_date < today ? daysBetween(t.due_date, today) : 0;
    const dueToday = t.due_date === today;
    const weight = PRIORITY_WEIGHT[t.priority ?? 'low'] ?? 1;
    const score = (overdueDays > 0 ? 100 + Math.min(overdueDays, 30) : 0) + (dueToday ? 50 : 0) + weight * 10;
    let why: Priority['why'];
    if (overdueDays > 0) {
      why = { ar: `متأخرة ${overdueDays} ${overdueDays === 1 ? 'يوم' : 'أيام'}`, en: `${overdueDays} day${overdueDays === 1 ? '' : 's'} overdue` };
    } else if (dueToday) {
      why = { ar: weight === 3 ? 'أولوية عالية ومستحقة اليوم' : 'مستحقة اليوم', en: weight === 3 ? 'High priority, due today' : 'Due today' };
    } else {
      why = { ar: weight === 3 ? 'أولوية عالية' : 'مفتوحة بدون موعد قريب', en: weight === 3 ? 'High priority' : 'Open, no near deadline' };
    }
    return { title: t.title, why, score };
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, 3).map(({ title, why }) => ({ title, why }));
}

const fmtSar = (n: number, lang: 'ar' | 'en') =>
  `${Math.round(n).toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-US')} ${lang === 'ar' ? 'ر.س' : 'SAR'}`;

export const JoodCommandCenter: React.FC<Props> = ({ onOpenMajlis, onNavigate }) => {
  const { session } = useAuth();
  const { lang, dir } = useLanguage();
  const L = lang === 'en' ? 'en' : 'ar';
  const { tz, todayStr, formatTime } = useTimezone();
  const { brief, loading: briefLoading, generate, markSpoken } = useDailyBrief(L);
  const { speakMessage, stopSpeaking, speaking, speakingIntensity } = useChat();

  const [sources, setSources] = useState<SourceStatus[]>(
    (Object.keys(SOURCE_LABEL) as SourceKey[]).map(key => ({ key, online: null, count: 0, line: { ar: '…', en: '…' } })),
  );
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [monthSpend, setMonthSpend] = useState<number | null>(null);
  const [monthIncome, setMonthIncome] = useState<number | null>(null);
  const [habitsDone, setHabitsDone] = useState<{ done: number; total: number } | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [visibleLog, setVisibleLog] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const [refreshing, setRefreshing] = useState(false);
  const loadSeq = useRef(0);

  // ── Live clock ────────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // ── Reveal the activity log one line at a time ────────────────────────────
  useEffect(() => {
    if (visibleLog >= log.length) return;
    const id = setTimeout(() => setVisibleLog(v => v + 1), 350);
    return () => clearTimeout(id);
  }, [visibleLog, log.length]);

  const setSource = useCallback((s: SourceStatus) => {
    setSources(prev => prev.map(p => (p.key === s.key ? s : p)));
    setLog(prev => [...prev, `${s.online ? '●' : '○'} ${SOURCE_LABEL[s.key][L]} — ${s.line[L]}`]);
  }, [L]);

  // ── Pull every source in parallel; each one reports its own status ───────
  const load = useCallback(async () => {
    if (!session) return;
    const seq = ++loadSeq.current;
    const uid = session.user.id;
    // events/habits/user_memories aren't in the generated types yet
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const monthStart = `${todayStr.slice(0, 7)}-01`;
    setRefreshing(true);
    setLog([]);
    setVisibleLog(0);
    setSources(prev => prev.map(p => ({ ...p, online: null, line: { ar: '…', en: '…' } })));

    const stale = () => seq !== loadSeq.current;

    const calendar = (async () => {
      const { data, error } = await db.from('events').select('title, start_at')
        .eq('user_id', uid)
        .gte('start_at', `${todayStr}T00:00:00`).lte('start_at', `${todayStr}T23:59:59`)
        .order('start_at');
      if (stale()) return;
      if (error) {
        setSource({ key: 'calendar', online: false, count: 0, line: { ar: 'تعذّر القراءة', en: 'read failed' } });
        return;
      }
      const rows = (data ?? []) as EventRow[];
      setEvents(rows);
      setSource({
        key: 'calendar', online: true, count: rows.length,
        line: rows.length
          ? { ar: `${rows.length} موعد اليوم`, en: `${rows.length} event${rows.length === 1 ? '' : 's'} today` }
          : { ar: 'لا مواعيد اليوم', en: 'no events today' },
      });
    })();

    const taskSrc = (async () => {
      const { data, error } = await db.from('tasks').select('title, due_date, priority, status')
        .eq('user_id', uid).not('status', 'in', '(completed,cancelled)');
      if (stale()) return;
      if (error) {
        setSource({ key: 'tasks', online: false, count: 0, line: { ar: 'تعذّر القراءة', en: 'read failed' } });
        return;
      }
      const rows = (data ?? []) as TaskRow[];
      setTasks(rows);
      const overdue = rows.filter(t => t.due_date && t.due_date < todayStr).length;
      setSource({
        key: 'tasks', online: true, count: rows.length,
        line: rows.length
          ? { ar: `${rows.length} مفتوحة${overdue ? `، ${overdue} متأخرة` : ''}`, en: `${rows.length} open${overdue ? `, ${overdue} overdue` : ''}` }
          : { ar: 'لا مهام مفتوحة', en: 'no open tasks' },
      });
    })();

    const finance = (async () => {
      const { data, error } = await db.from('financial_data').select('type, amount, category, created_at')
        .eq('user_id', uid).gte('created_at', `${monthStart}T00:00:00`);
      if (stale()) return;
      if (error) {
        setMonthSpend(null); setMonthIncome(null);
        setSource({ key: 'finance', online: false, count: 0, line: { ar: 'تعذّر القراءة', en: 'read failed' } });
        return;
      }
      const rows = (data ?? []) as FinanceRow[];
      const spend = rows.filter(r => r.type === 'expense').reduce((s, r) => s + Number(r.amount || 0), 0);
      const income = rows.filter(r => r.type === 'income').reduce((s, r) => s + Number(r.amount || 0), 0);
      setMonthSpend(spend); setMonthIncome(income);
      setSource({
        key: 'finance', online: true, count: rows.length,
        line: rows.length
          ? { ar: `مصروف الشهر ${fmtSar(spend, 'ar')}`, en: `month spend ${fmtSar(spend, 'en')}` }
          : { ar: 'لا حركات هذا الشهر', en: 'no entries this month' },
      });
    })();

    const habits = (async () => {
      const [h, logs] = await Promise.all([
        db.from('habits').select('id').eq('user_id', uid).eq('is_active', true),
        db.from('habit_logs').select('habit_id').eq('user_id', uid).eq('completed_date', todayStr),
      ]);
      if (stale()) return;
      if (h.error || logs.error) {
        setHabitsDone(null);
        setSource({ key: 'habits', online: false, count: 0, line: { ar: 'تعذّر القراءة', en: 'read failed' } });
        return;
      }
      const total = (h.data ?? []).length;
      const done = new Set((logs.data ?? []).map((l: { habit_id: string }) => l.habit_id)).size;
      setHabitsDone({ done, total });
      setSource({
        key: 'habits', online: true, count: total,
        line: total ? { ar: `${done} من ${total} اليوم`, en: `${done} of ${total} today` } : { ar: 'لا عادات نشطة', en: 'no active habits' },
      });
    })();

    const memory = (async () => {
      const { count, error } = await db.from('user_memories').select('id', { count: 'exact', head: true }).eq('user_id', uid);
      if (stale()) return;
      if (error) {
        setSource({ key: 'memory', online: false, count: 0, line: { ar: 'تعذّر القراءة', en: 'read failed' } });
        return;
      }
      const n = count ?? 0;
      setSource({ key: 'memory', online: true, count: n, line: { ar: `${n} معلومة محفوظة`, en: `${n} memories stored` } });
    })();

    await Promise.allSettled([calendar, taskSrc, finance, habits, memory]);
    if (!stale()) setRefreshing(false);
  }, [session, todayStr, setSource]);

  useEffect(() => { load(); }, [load]);

  // ── Derived: priorities, one thing to know, closer ────────────────────────
  const priorities = useMemo(() => rankPriorities(tasks, todayStr), [tasks, todayStr]);

  const oneThing = useMemo((): { ar: string; en: string } | null => {
    const overdue = tasks.filter(t => t.due_date && t.due_date < todayStr);
    if (overdue.length) {
      const oldest = overdue.sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1))[0];
      const d = daysBetween(oldest.due_date!, todayStr);
      return { ar: `"${oldest.title}" متأخرة ${d} ${d === 1 ? 'يوم' : 'أيام'} — لا تخليها تطوّل أكثر.`, en: `"${oldest.title}" is ${d} day${d === 1 ? '' : 's'} overdue — don't let it slip further.` };
    }
    const upcoming = events.find(e => Date.parse(e.start_at) > now.getTime());
    if (upcoming) {
      const at = formatTime(upcoming.start_at);
      return { ar: `موعدك القادم "${upcoming.title}" الساعة ${at}.`, en: `Next up: "${upcoming.title}" at ${at}.` };
    }
    if (monthSpend !== null && monthIncome !== null && monthIncome > 0 && monthSpend > monthIncome) {
      return { ar: `مصروف هذا الشهر تجاوز الدخل بـ ${fmtSar(monthSpend - monthIncome, 'ar')}.`, en: `This month's spend is ${fmtSar(monthSpend - monthIncome, 'en')} over income.` };
    }
    if (habitsDone && habitsDone.total > habitsDone.done) {
      const left = habitsDone.total - habitsDone.done;
      return { ar: `باقي ${left} من عاداتك اليوم.`, en: `${left} habit${left === 1 ? '' : 's'} left for today.` };
    }
    return null;
  }, [tasks, events, monthSpend, monthIncome, habitsDone, todayStr, now, formatTime]);

  const closer = L === 'ar' ? 'وش تبيني أبدأ فيه أول؟' : 'What should I handle first?';

  // ── Voice actions ─────────────────────────────────────────────────────────
  const speakBrief = useCallback(async () => {
    if (speaking) { stopSpeaking(); return; }
    if (!brief) { await generate(false); return; }
    const greeting = L === 'en' ? brief.meta?.greeting_en ?? brief.greeting : brief.greeting;
    const content  = L === 'en' ? brief.meta?.content_en ?? brief.content : brief.content;
    markSpoken();
    await speakMessage(`${greeting}. ${content}`, 'warm', false);
  }, [speaking, stopSpeaking, brief, generate, L, markSpoken, speakMessage]);

  // Answers "what first?" from the ranked list — no LLM round trip.
  const speakFirst = useCallback(async () => {
    if (speaking) { stopSpeaking(); return; }
    const top = priorities[0];
    const text = top
      ? (L === 'ar' ? `ابدأ بـ ${top.title}، لأنها ${top.why.ar}.` : `Start with ${top.title} — ${top.why.en.toLowerCase()}.`)
      : (L === 'ar' ? 'ما عندك مهام مفتوحة. يومك فاضي، استغله في شي يقربك من هدفك.' : 'No open tasks. Your day is clear — use it on something that moves your goal.');
    await speakMessage(text, 'confident', true);
  }, [speaking, stopSpeaking, priorities, L, speakMessage]);

  const orbMode: OrbMode = speaking ? 'speaking' : briefLoading || refreshing ? 'thinking' : 'idle';
  const onlineCount = sources.filter(s => s.online).length;
  const tickerItems = [
    ...(brief?.highlights ?? []).map(h => String((h as unknown as Record<string, unknown>)[`text_${L}`] ?? h.text ?? '')).filter(Boolean),
    ...sources.filter(s => s.online !== null).map(s => `${SOURCE_LABEL[s.key][L]}: ${s.line[L]}`),
  ];

  const clock = now.toLocaleTimeString(L === 'ar' ? 'ar-SA' : 'en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateLine = now.toLocaleDateString(L === 'ar' ? 'ar-SA-u-ca-islamic' : 'en-GB', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div dir={dir} className="relative overflow-hidden rounded-3xl border border-jood-gold-500/20 bg-[#04121a] text-[#d8efef] shadow-elegant">
      {/* scanlines + vignette */}
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.06] [background:repeating-linear-gradient(0deg,#fff_0,#fff_1px,transparent_1px,transparent_3px)]" />
      <div aria-hidden className="pointer-events-none absolute inset-0 [background:radial-gradient(ellipse_at_center,transparent_45%,rgba(0,0,0,0.65)_100%)]" />

      <div className="relative grid gap-4 p-4 sm:p-6 lg:grid-cols-[1fr_minmax(280px,360px)_1fr]">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="lg:col-span-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-arabic text-2xl sm:text-3xl font-bold tracking-wide text-jood-gold-300">
              {L === 'ar' ? 'مركز قيادة جود' : 'JOOD COMMAND'}
            </h2>
            <p className="font-arabic text-xs text-[#8fbcbc]">{dateLine}</p>
          </div>
          <div className="text-end">
            <div className="font-mono text-xl sm:text-2xl tabular-nums text-[#66c4c4]" dir="ltr">{clock}</div>
            <div className="font-arabic text-[11px] text-[#8fbcbc]">
              {L === 'ar' ? `${onlineCount} من ${sources.length} مصادر متصلة` : `${onlineCount}/${sources.length} sources online`}
            </div>
          </div>
        </header>

        {/* ── Left: sources + activity log ───────────────────────────────── */}
        <section className="space-y-3 order-2 lg:order-1">
          <Panel title={L === 'ar' ? 'المصادر' : 'Sources'} icon={<Radio className="h-3.5 w-3.5" />}>
            <ul className="space-y-1.5">
              {sources.map(s => (
                <li key={s.key} className="flex items-center justify-between gap-2 text-xs font-arabic">
                  <span className="flex items-center gap-2">
                    <span className={cn('h-2 w-2 rounded-full',
                      s.online === null && 'bg-slate-500 animate-pulse',
                      s.online === true && 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]',
                      s.online === false && 'bg-amber-400 animate-pulse')} />
                    {SOURCE_LABEL[s.key][L]}
                  </span>
                  <span className={cn('text-[11px]', s.online === false ? 'text-amber-300' : 'text-[#8fbcbc]')}>
                    {s.online === false ? (L === 'ar' ? 'غير متصل' : 'offline') : s.line[L]}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title={L === 'ar' ? 'سجل النشاط' : 'Activity'} icon={<Activity className="h-3.5 w-3.5" />}>
            <ul className="min-h-[96px] space-y-1 font-mono text-[11px] text-[#9fd3d3]">
              <AnimatePresence initial={false}>
                {log.slice(0, visibleLog).map((line, i) => (
                  <motion.li key={`${i}-${line}`} initial={{ opacity: 0, x: L === 'ar' ? 8 : -8 }} animate={{ opacity: 1, x: 0 }} className="font-arabic">
                    {line}
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </Panel>
        </section>

        {/* ── Center: the orb + voice controls ───────────────────────────── */}
        <section className="order-1 lg:order-2 flex flex-col items-center justify-center gap-4">
          <JoodOrb mode={orbMode} intensity={speakingIntensity} size={260} withRings />
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={speakBrief}
              disabled={briefLoading && !speaking}
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-5 py-2.5 font-arabic text-sm font-bold transition-all',
                'border border-jood-gold-500/60 bg-jood-gold-500/15 text-jood-gold-200 shadow-[0_0_18px_rgba(184,146,74,0.35)] hover:bg-jood-gold-500/25',
                'disabled:opacity-50',
              )}
            >
              {speaking ? <Square className="h-4 w-4" /> : <Radio className="h-4 w-4" />}
              {speaking
                ? (L === 'ar' ? 'إيقاف' : 'Stop')
                : briefLoading ? (L === 'ar' ? 'جود تجهّز الموجز…' : 'Preparing…')
                : (L === 'ar' ? 'موجز جود' : 'Brief me')}
            </button>
            {onOpenMajlis && (
              <button
                onClick={onOpenMajlis}
                className="inline-flex items-center gap-2 rounded-full border border-[#66c4c4]/50 bg-[#66c4c4]/10 px-5 py-2.5 font-arabic text-sm font-bold text-[#bfe9e9] hover:bg-[#66c4c4]/20"
              >
                <Mic className="h-4 w-4" />
                {L === 'ar' ? 'يا جود' : 'Hey Jood'}
              </button>
            )}
            <button
              onClick={() => { load(); generate(true); }}
              aria-label={L === 'ar' ? 'تحديث' : 'Refresh'}
              className="rounded-full border border-white/10 p-2.5 text-[#8fbcbc] hover:text-white"
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            </button>
          </div>
          {brief && (
            <p className="max-w-sm text-center font-arabic text-sm leading-relaxed text-[#cfe7e7]">
              {L === 'en' ? brief.meta?.content_en ?? brief.content : brief.content}
            </p>
          )}
        </section>

        {/* ── Right: priorities, stats, one thing ────────────────────────── */}
        <section className="space-y-3 order-3">
          <Panel title={L === 'ar' ? 'أهم ٣ اليوم' : 'Top 3 today'} icon={<Target className="h-3.5 w-3.5" />}>
            {priorities.length ? (
              <ol className="space-y-2">
                {priorities.map((p, i) => (
                  <li key={`${i}-${p.title}`} className="font-arabic">
                    <div className="flex items-baseline gap-2 text-sm text-white">
                      <span className="font-mono text-jood-gold-300">{i + 1}</span>{p.title}
                    </div>
                    <div className="ps-5 text-[11px] text-[#8fbcbc]">{p.why[L]}</div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="font-arabic text-xs text-[#8fbcbc]">
                {sources.find(s => s.key === 'tasks')?.online === false
                  ? (L === 'ar' ? 'المهام غير متصلة — ما أقدر أرتب أولوياتك الحين.' : 'Tasks offline — can’t rank priorities right now.')
                  : (L === 'ar' ? 'ما عندك مهام مفتوحة.' : 'No open tasks.')}
              </p>
            )}
            <button onClick={() => onNavigate?.('planning')} className="mt-2 font-arabic text-[11px] text-jood-gold-300 hover:underline">
              {L === 'ar' ? 'فتح التخطيط ←' : 'Open planning →'}
            </button>
          </Panel>

          <Panel title={L === 'ar' ? 'الأرقام' : 'Numbers'}>
            <div className="grid grid-cols-2 gap-2">
              <Stat label={L === 'ar' ? 'مواعيد اليوم' : 'Events today'} value={sourceValue(sources, 'calendar', events.length, L)} />
              <Stat label={L === 'ar' ? 'مهام مفتوحة' : 'Open tasks'} value={sourceValue(sources, 'tasks', tasks.length, L)} />
              <Stat label={L === 'ar' ? 'مصروف الشهر' : 'Month spend'} value={monthSpend === null ? '—' : fmtSar(monthSpend, L)} />
              <Stat label={L === 'ar' ? 'العادات' : 'Habits'} value={habitsDone ? `${habitsDone.done}/${habitsDone.total}` : '—'}
                fill={habitsDone && habitsDone.total ? habitsDone.done / habitsDone.total : undefined} />
            </div>
          </Panel>

          <Panel title={L === 'ar' ? 'شي لازم تعرفه' : 'One thing to know'} icon={<Lightbulb className="h-3.5 w-3.5" />}>
            <p className="font-arabic text-sm text-amber-200">
              {oneThing ? oneThing[L] : (L === 'ar' ? 'ما فيه شي يستاهل التنبيه اليوم.' : 'Nothing that needs flagging today.')}
            </p>
          </Panel>
        </section>

        {/* ── Bottom bar: ticker + closer ────────────────────────────────── */}
        <footer className="order-4 lg:col-span-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 overflow-hidden rounded-full border border-white/10 bg-white/[0.03] py-2">
            <div className="inline-block min-w-full whitespace-nowrap px-4 font-arabic text-xs text-[#9fd3d3] animate-[jood-ticker_40s_linear_infinite] hover:[animation-play-state:paused]">
              {tickerItems.length ? tickerItems.join('   ◆   ') : (L === 'ar' ? 'جود تقرأ مصادرك…' : 'Jood is reading your sources…')}
            </div>
          </div>
          <button
            onClick={speakFirst}
            className="rounded-full border border-jood-gold-500/50 bg-jood-gold-500/10 px-5 py-2 font-arabic text-sm font-bold text-jood-gold-200 hover:bg-jood-gold-500/20"
          >
            {closer}
          </button>
        </footer>
      </div>
      <style>{`@keyframes jood-ticker { from { transform: translateX(${L === 'ar' ? '-100%' : '100%'}); } to { transform: translateX(${L === 'ar' ? '100%' : '-100%'}); } }`}</style>
    </div>
  );
};

function sourceValue(sources: SourceStatus[], key: SourceKey, n: number, L: 'ar' | 'en'): string {
  const s = sources.find(x => x.key === key);
  if (!s || s.online === null || s.online === false) return '—';
  return n.toLocaleString(L === 'ar' ? 'ar-SA' : 'en-US');
}

const Panel: React.FC<{ title: string; icon?: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div className="rounded-2xl border border-[#66c4c4]/15 bg-[#071d26]/80 p-3 backdrop-blur-sm">
    <div className="mb-2 flex items-center gap-1.5 font-arabic text-[11px] font-bold uppercase tracking-wider text-[#66c4c4]">
      {icon}{title}
    </div>
    {children}
  </div>
);

const Stat: React.FC<{ label: string; value: string; fill?: number }> = ({ label, value, fill }) => (
  <div className="rounded-xl bg-white/[0.03] p-2">
    <div className="font-arabic text-[10px] text-[#8fbcbc]">{label}</div>
    <div className="font-arabic text-base font-bold text-white">{value}</div>
    {fill !== undefined && (
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-[#66c4c4] shadow-[0_0_6px_#66c4c4]" style={{ width: `${Math.round(fill * 100)}%` }} />
      </div>
    )}
  </div>
);

export default JoodCommandCenter;
