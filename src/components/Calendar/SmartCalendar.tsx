import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  ChevronLeft, ChevronRight, Plus, Calendar as CalIcon, Moon,
  Trash2, Repeat, MapPin, Bell, Sparkles, Check, Flame, CheckSquare,
  LayoutGrid, Columns, AlignJustify, Star,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useTasks, Task } from '@/hooks/useDatabase';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────
interface EventRow {
  id: string; user_id: string; title: string; description: string | null;
  // Wave-3 columns (nullable — legacy table already had start_at/end_at)
  starts_at: string | null; ends_at: string | null;
  // Legacy columns (now nullable after migration)
  start_at: string | null; end_at: string | null;
  all_day: boolean | null;
  category: string | null; color: string | null; location: string | null;
  recurrence: string | null; hijri_anchor: boolean;
  reminder_min: number | null; prayer_linked: string | null;
  source: string | null; completed_at: string | null; created_at: string;
}

interface Habit {
  id: string; user_id: string; name: string;
  frequency: string; target_days: number[] | null;
  color: string | null; icon: string | null;
  is_active: boolean; created_at: string;
}

interface HabitLog {
  id: string; habit_id: string; user_id: string;
  // DB has "date" column; we also write "completed_date" after migration
  date?: string | null;
  completed_date?: string | null;
}

type ViewMode = 'month' | 'week' | 'day';
type AddType = 'event' | 'task' | 'habit';

// ─── Constants ────────────────────────────────────────────────────────────────
const AR_MONTHS = [
  'يناير','فبراير','مارس','أبريل','مايو','يونيو',
  'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر',
];
const AR_WEEKDAYS_SHORT = ['أحد','إثن','ثلا','أرب','خمي','جمع','سبت'];
const AR_WEEKDAYS = ['أحد','إثنين','ثلاثاء','أربعاء','خميس','جمعة','سبت'];

const CATEGORIES = [
  { value: 'personal', label: 'شخصي',  color: 'bg-jood-teal-700 text-white' },
  { value: 'finance',  label: 'مالي',   color: 'bg-jood-gold-500 text-white' },
  { value: 'health',   label: 'صحة',    color: 'bg-emerald-600 text-white' },
  { value: 'prayer',   label: 'ديني',   color: 'bg-indigo-600 text-white' },
  { value: 'family',   label: 'عائلة',  color: 'bg-rose-500 text-white' },
  { value: 'work',     label: 'عمل',    color: 'bg-slate-700 text-white' },
];
const cat = (v: string) => CATEGORIES.find(c => c.value === v) ?? CATEGORIES[0];

const PRIORITY_COLORS: Record<string, string> = {
  high: 'text-red-500', medium: 'text-amber-500', low: 'text-emerald-500',
};

const YEARS = Array.from({ length: 20 }, (_, i) => 2026 + i); // 2026-2045

// ─── Helpers ──────────────────────────────────────────────────────────────────
const toHijri = (d: Date) => {
  try {
    const fmt = new Intl.DateTimeFormat('ar-SA-u-ca-islamic', { day: 'numeric', month: 'long' });
    const parts = fmt.formatToParts(d);
    return {
      day: parts.find(p => p.type === 'day')?.value ?? '',
      month: parts.find(p => p.type === 'month')?.value ?? '',
    };
  } catch { return { day: '', month: '' }; }
};

const parseRecurrence = (text: string): { recurrence: string | null; hijri: boolean } => {
  const hijri = /هجري|هلالي|رمضان|شعبان|محرم|صفر|ربيع|جمادى|رجب|ذو/i.test(text);
  if (/يوميا|كل\s*يوم/.test(text))            return { recurrence: 'daily', hijri };
  if (/اسبوعيا|أسبوعيا|كل\s*(جمعة|سبت|أحد|اثنين|ثلاثاء|أربعاء|خميس|أسبوع)/.test(text))
                                                return { recurrence: 'weekly', hijri };
  if (/شهريا|كل\s*شهر/.test(text))            return { recurrence: 'monthly', hijri };
  if (/سنويا|كل\s*(سنة|عام)/.test(text))      return { recurrence: 'yearly', hijri };
  return { recurrence: null, hijri };
};

const RECURRENCE_LABELS: Record<string, string> = {
  daily: 'يومي', weekly: 'أسبوعي', monthly: 'شهري', yearly: 'سنوي',
};

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const dateStr = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// ─── Recurrence matching ──────────────────────────────────────────────────────
const eventOccursOn = (e: EventRow, day: Date): boolean => {
  const rawStart = e.starts_at ?? e.start_at;
  if (!rawStart) return false;
  const s = new Date(rawStart);
  if (isSameDay(s, day)) return true;
  if (day < s) return false;
  switch (e.recurrence) {
    case 'daily':   return true;
    case 'weekly':  return s.getDay() === day.getDay();
    case 'monthly': return s.getDate() === day.getDate();
    case 'yearly':  return s.getDate() === day.getDate() && s.getMonth() === day.getMonth();
    default:        return false;
  }
};

const taskOccursOn = (t: Task, day: Date): boolean => {
  if (!t.due_date) return isSameDay(day, new Date()); // undated tasks surface on today
  return t.due_date === dateStr(day);
};

const habitOccursOn = (h: Habit, day: Date): boolean => {
  if (h.is_active === false) return false; // undefined/null = active by default
  if (!h.target_days || h.target_days.length === 0) return true; // daily (or no specific days)
  return h.target_days.includes(day.getDay());
};

// ─── Grid builders ────────────────────────────────────────────────────────────
const buildMonthGrid = (y: number, m: number): Date[] => {
  const first = new Date(y, m, 1);
  const offset = first.getDay();
  const start = new Date(y, m, 1 - offset);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
};

const buildWeekGrid = (anchor: Date): Date[] => {
  const dow = anchor.getDay();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(anchor);
    d.setDate(anchor.getDate() - dow + i);
    return d;
  });
};

// ─── Day items aggregator ─────────────────────────────────────────────────────
interface DayItems {
  events: EventRow[];
  tasks: Task[];
  habits: Habit[];
  habitLogs: HabitLog[];
}

// ─── Quick-add form state ─────────────────────────────────────────────────────
interface EventForm {
  title: string; description: string; date: string; time: string;
  category: string; all_day: boolean; location: string;
  reminder_min: number; nlPhrase: string; recurrence: string;
}

const defaultEventForm = (d: Date): EventForm => ({
  title: '', description: '', date: dateStr(d), time: '09:00',
  category: 'personal', all_day: false, location: '',
  reminder_min: 15, nlPhrase: '', recurrence: 'none',
});

// ══════════════════════════════════════════════════════════════════════════════
const SmartCalendar: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { tasks, updateTask, addTask } = useTasks();

  const now = new Date();
  const [viewY, setViewY]       = useState(now.getFullYear());
  const [viewM, setViewM]       = useState(now.getMonth());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [selected, setSelected] = useState<Date>(now);
  const [showHijri, setShowHijri] = useState(false);

  const [events, setEvents]     = useState<EventRow[]>([]);
  const [habits, setHabits]     = useState<Habit[]>([]);
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>([]);
  const [loading, setLoading]   = useState(true);

  // Dialog state
  const [addDialog, setAddDialog] = useState<{ open: boolean; type: AddType }>({ open: false, type: 'event' });
  const [eventForm, setEventForm] = useState<EventForm>(defaultEventForm(now));
  const [quickTask, setQuickTask] = useState('');
  const [quickTaskPriority, setQuickTaskPriority] = useState<'low'|'medium'|'high'>('medium');
  const [quickTaskRecurrence, setQuickTaskRecurrence] = useState('none');
  const [quickHabit, setQuickHabit] = useState('');
  const [quickHabitRecurrence, setQuickHabitRecurrence] = useState('none');
  const [saving, setSaving]     = useState(false);

  // ── Load all data ────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [evRes, habRes, logRes] = await Promise.all([
        (supabase as any).from('events').select('*').eq('user_id', user.id).order('starts_at'),
        (supabase as any).from('habits').select('*').eq('user_id', user.id),
        (supabase as any).from('habit_logs').select('*').eq('user_id', user.id)
          .gte('date', `${viewY - 1}-01-01`)
          .lte('date', `${viewY + 1}-12-31`),
      ]);
      setEvents(evRes.data ?? []);
      setHabits(habRes.data ?? []);
      setHabitLogs(logRes.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [user, viewY]);

  useEffect(() => { load(); }, [load]);

  // ── Realtime subscriptions — refresh calendar when AI or other components write to DB ──
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`calendar-rt-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events',     filter: `user_id=eq.${user.id}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'habits',     filter: `user_id=eq.${user.id}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'habit_logs', filter: `user_id=eq.${user.id}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks',      filter: `user_id=eq.${user.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, load]);

  // ── Grid ─────────────────────────────────────────────────────────────────────
  const monthGrid = useMemo(() => buildMonthGrid(viewY, viewM), [viewY, viewM]);
  const weekGrid  = useMemo(() => buildWeekGrid(selected), [selected]);

  // ── Items for a given day ─────────────────────────────────────────────────────
  const getItems = useCallback((day: Date): DayItems => {
    const ds = dateStr(day);
    return {
      events:    events.filter(e => eventOccursOn(e, day)),
      tasks:     tasks.filter(t => taskOccursOn(t, day)),
      habits:    habits.filter(h => habitOccursOn(h, day)),
      habitLogs: habitLogs.filter(l => (l.completed_date ?? l.date) === ds),
    };
  }, [events, tasks, habits, habitLogs]);

  // ── Precompute month dot data ─────────────────────────────────────────────────
  const monthDots = useMemo(() => {
    const map = new Map<string, { events: number; tasks: number; habits: number; done: number }>();
    monthGrid.forEach(d => {
      const items = getItems(d);
      const ds = dateStr(d);
      const doneHabits = items.habits.filter(h => items.habitLogs.some(l => l.habit_id === h.id)).length;
      map.set(ds, {
        events: items.events.length,
        tasks:  items.tasks.length,
        habits: items.habits.length,
        done:   doneHabits + items.tasks.filter(t => t.status === 'completed').length,
      });
    });
    return map;
  }, [monthGrid, getItems]);

  // ── Selected day items ────────────────────────────────────────────────────────
  const selectedItems = useMemo(() => getItems(selected), [getItems, selected]);

  // ── Navigation ───────────────────────────────────────────────────────────────
  const prevPeriod = () => {
    if (viewMode === 'month') {
      if (viewM === 0) { setViewY(y => y - 1); setViewM(11); }
      else setViewM(m => m - 1);
    } else if (viewMode === 'week') {
      const d = new Date(selected); d.setDate(d.getDate() - 7); setSelected(d);
    } else {
      const d = new Date(selected); d.setDate(d.getDate() - 1); setSelected(d);
    }
  };

  const nextPeriod = () => {
    if (viewMode === 'month') {
      if (viewM === 11) { setViewY(y => y + 1); setViewM(0); }
      else setViewM(m => m + 1);
    } else if (viewMode === 'week') {
      const d = new Date(selected); d.setDate(d.getDate() + 7); setSelected(d);
    } else {
      const d = new Date(selected); d.setDate(d.getDate() + 1); setSelected(d);
    }
  };

  const jumpToday = () => {
    const t = new Date();
    setViewY(t.getFullYear()); setViewM(t.getMonth()); setSelected(t);
  };

  const openAdd = (type: AddType) => {
    setEventForm(defaultEventForm(selected));
    setQuickTask(''); setQuickHabit('');
    setAddDialog({ open: true, type });
  };

  // ── Save event ────────────────────────────────────────────────────────────────
  const saveEvent = async () => {
    if (!user || !eventForm.title.trim() || !eventForm.date) {
      toast({ title: 'أكملي البيانات', variant: 'destructive' }); return;
    }
    setSaving(true);
    const parsed = parseRecurrence(eventForm.nlPhrase || eventForm.title);
    const recurrence = (eventForm.recurrence === 'none' ? '' : eventForm.recurrence) || parsed.recurrence;
    const startsAt = eventForm.all_day
      ? new Date(`${eventForm.date}T00:00:00`).toISOString()
      : new Date(`${eventForm.date}T${eventForm.time}:00`).toISOString();

    // Compute end time: all-day stays same timestamp; timed events default to +1 hour
    const endsAt = eventForm.all_day
      ? startsAt
      : new Date(new Date(startsAt).getTime() + 60 * 60 * 1000).toISOString();

    const { error } = await (supabase as any).from('events').insert({
      user_id:     user.id,
      title:       eventForm.title.trim(),
      description: eventForm.description.trim() || null,
      // Wave-3 columns
      starts_at:   startsAt,
      ends_at:     endsAt,
      // Legacy columns (still present in DB, now nullable — keep in sync)
      start_at:    startsAt,
      end_at:      endsAt,
      all_day:     eventForm.all_day,
      category:    eventForm.category,
      location:    eventForm.location.trim() || null,
      recurrence,
      hijri_anchor: parsed.hijri,
      reminder_min: eventForm.reminder_min || null,
      source:       eventForm.nlPhrase ? 'nlu' : 'user',
    });

    setSaving(false);
    if (error) { toast({ title: 'تعذر الحفظ', description: error.message, variant: 'destructive' }); return; }
    toast({ title: recurrence ? `حدث متكرر — ${RECURRENCE_LABELS[recurrence] ?? recurrence}` : 'تم الحفظ ✓' });
    setAddDialog({ open: false, type: 'event' });
    load();
  };

  // ── Save task ─────────────────────────────────────────────────────────────────
  const saveTask = async () => {
    if (!quickTask.trim()) return;
    setSaving(true);
    const recurrenceLabel = quickTaskRecurrence === 'none' ? null : quickTaskRecurrence;
    // Store recurrence in category note as workaround (category field allows custom strings)
    await addTask({
      title: quickTask.trim() + (recurrenceLabel ? ` [${recurrenceLabel}]` : ''),
      description: null, status: 'pending', priority: quickTaskPriority,
      category: 'general', due_date: dateStr(selected), completed_at: null,
    });
    setSaving(false);
    setAddDialog({ open: false, type: 'task' });
    setQuickTask('');
    setQuickTaskRecurrence('none');
  };

  // ── Save habit ────────────────────────────────────────────────────────────────
  const saveHabit = async () => {
    if (!user || !quickHabit.trim()) return;
    setSaving(true);
    const freq = quickHabitRecurrence === 'none' ? 'daily' : quickHabitRecurrence;
    // For weekly habits, default to the currently selected weekday
    const targetDays = freq === 'weekly' ? [selected.getDay()] : null;

    const { error } = await (supabase as any).from('habits').insert({
      user_id:     user.id,
      name:        quickHabit.trim(),
      frequency:   freq,
      target_days: targetDays,
      color:       '#0E4E4E',
      icon:        '⭐',
      is_active:   true,
    });
    setSaving(false);
    if (error) { toast({ title: 'خطأ', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'تمت إضافة العادة' });
    setAddDialog({ open: false, type: 'habit' });
    setQuickHabit('');
    setQuickHabitRecurrence('none');
    load();
  };

  // ── Toggle task done ──────────────────────────────────────────────────────────
  const toggleTask = (t: Task) => {
    updateTask(t.id, {
      status: t.status === 'completed' ? 'pending' : 'completed',
      completed_at: t.status === 'pending' ? new Date().toISOString() : null,
    });
  };

  // ── Toggle habit log ──────────────────────────────────────────────────────────
  const toggleHabit = async (habitId: string, day: Date) => {
    if (!user) return;
    const ds = dateStr(day);
    const existing = habitLogs.find(l => l.habit_id === habitId && (l.completed_date ?? l.date) === ds);
    if (existing) {
      await (supabase as any).from('habit_logs').delete().eq('id', existing.id);
      setHabitLogs(prev => prev.filter(l => l.id !== existing.id));
    } else {
      const { data, error } = await (supabase as any).from('habit_logs').insert({
        habit_id: habitId, user_id: user.id,
        date: ds,           // original DB column
        completed_date: ds, // new column added by migration
      }).select().single();
      if (!error && data) setHabitLogs(prev => [...prev, data]);
    }
  };

  // ── Delete event ──────────────────────────────────────────────────────────────
  const deleteEvent = async (id: string) => {
    await (supabase as any).from('events').delete().eq('id', id);
    setEvents(prev => prev.filter(e => e.id !== id));
  };

  // ── Period label ─────────────────────────────────────────────────────────────
  const periodLabel = () => {
    if (viewMode === 'month') return `${AR_MONTHS[viewM]} ${viewY}`;
    if (viewMode === 'week') {
      const wg = buildWeekGrid(selected);
      return `${wg[0].getDate()} - ${wg[6].getDate()} ${AR_MONTHS[wg[3].getMonth()]} ${wg[3].getFullYear()}`;
    }
    return `${selected.getDate()} ${AR_MONTHS[selected.getMonth()]} ${selected.getFullYear()}`;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── Day Detail Panel ──────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  const DayPanel: React.FC<{ day: Date; items: DayItems; compact?: boolean }> = ({ day, items, compact }) => {
    const ds = dateStr(day);
    const isToday_ = isSameDay(day, now);
    const habitDone = (hId: string) => items.habitLogs.some(l => l.habit_id === hId);

    const totalItems = items.events.length + items.tasks.length + items.habits.length;
    const doneItems  = items.tasks.filter(t => t.status === 'completed').length +
                       items.habits.filter(h => habitDone(h.id)).length;
    const pct = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

    return (
      <div className={cn('space-y-3', compact && 'text-xs')}>
        {/* Day header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className={cn('font-bold font-arabic', compact ? 'text-sm' : 'text-base')}>
              {AR_WEEKDAYS[day.getDay()]}، {day.getDate()} {AR_MONTHS[day.getMonth()]}
              {isToday_ && <span className="mr-2 text-xs text-jood-gold-500 font-normal">اليوم</span>}
            </h3>
            {showHijri && (
              <p className="text-[10px] text-muted-foreground font-arabic flex items-center gap-1 mt-0.5">
                <Moon className="w-3 h-3" /> {toHijri(day).day} {toHijri(day).month}
              </p>
            )}
          </div>
          {totalItems > 0 && (
            <div className="flex items-center gap-2">
              <div className="text-[11px] text-muted-foreground font-arabic">{doneItems}/{totalItems}</div>
              <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-jood-teal-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* Events */}
        {items.events.length > 0 && (
          <div className="space-y-1">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide font-arabic">أحداث</p>
            {items.events.map(e => (
              <div key={e.id} className="flex items-center gap-2 p-2 rounded-xl border border-border/30 bg-card group">
                <span className={cn('w-2 h-2 rounded-full flex-shrink-0', cat(e.category).color.replace('text-white', ''))} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-arabic font-medium truncate">{e.title}</p>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-arabic">
                    {!e.all_day && (e.starts_at || e.start_at) && <span>⏰ {new Date((e.starts_at ?? e.start_at)!).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</span>}
                    {e.all_day && <span>طوال اليوم</span>}
                    {e.location && <span className="flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{e.location}</span>}
                    {e.recurrence && <Repeat className="w-3 h-3 text-jood-teal-400" />}
                  </div>
                </div>
                <button onClick={() => deleteEvent(e.id)} className="opacity-0 group-hover:opacity-60 hover:!opacity-100 text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Reminders — events that have a reminder_min set */}
        {items.events.some(e => e.reminder_min) && (
          <div className="space-y-1">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide font-arabic flex items-center gap-1">
              <Bell className="w-3 h-3" /> تذكيرات
            </p>
            {items.events.filter(e => e.reminder_min).map(e => {
              const rawStart = e.starts_at ?? e.start_at ?? new Date().toISOString();
              const reminderTime = new Date(new Date(rawStart).getTime() - e.reminder_min! * 60 * 1000);
              return (
                <div key={`rem-${e.id}`} className="flex items-center gap-2 p-2 rounded-xl border border-jood-gold-300/30 bg-jood-gold-500/5">
                  <Bell className="w-3 h-3 text-jood-gold-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-arabic truncate">
                      {e.reminder_min} دقيقة قبل <span className="font-semibold">{e.title}</span>
                    </p>
                    {!e.all_day && (
                      <p className="text-[10px] text-muted-foreground font-arabic">
                        ⏰ {reminderTime.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tasks */}
        {items.tasks.length > 0 && (
          <div className="space-y-1">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide font-arabic">مهام</p>
            {items.tasks.map(t => (
              <button
                key={t.id}
                onClick={() => toggleTask(t)}
                className={cn(
                  'w-full flex items-center gap-2.5 p-2 rounded-xl border border-border/30 bg-card hover:bg-muted/30 transition-colors text-right',
                  t.status === 'completed' && 'opacity-60',
                )}
              >
                <div className={cn(
                  'w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                  t.status === 'completed' ? 'bg-jood-teal-700 border-jood-teal-700' : 'border-border',
                )}>
                  {t.status === 'completed' && <Check className="w-2.5 h-2.5 text-white" />}
                </div>
                <span className={cn('text-xs font-arabic flex-1 truncate', t.status === 'completed' && 'line-through text-muted-foreground')}>
                  {t.title}
                </span>
                <span className={cn('text-[10px] flex-shrink-0', PRIORITY_COLORS[t.priority])}>●</span>
              </button>
            ))}
          </div>
        )}

        {/* Habits */}
        {items.habits.length > 0 && (
          <div className="space-y-1">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide font-arabic">عادات</p>
            {items.habits.map(h => {
              const done = habitDone(h.id);
              // Compute streak
              let streak = 0;
              const d2 = new Date(day);
              while (true) {
                const ds2 = dateStr(d2);
                if (habitLogs.some(l => l.habit_id === h.id && (l.completed_date ?? l.date) === ds2)) { streak++; d2.setDate(d2.getDate() - 1); }
                else break;
              }
              return (
                <button
                  key={h.id}
                  onClick={() => toggleHabit(h.id, day)}
                  className={cn(
                    'w-full flex items-center gap-2.5 p-2 rounded-xl border border-border/30 bg-card hover:bg-muted/30 transition-colors text-right',
                    done && 'border-jood-teal-500/40 bg-jood-teal-500/5',
                  )}
                >
                  <div className={cn(
                    'w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors',
                    done ? 'bg-jood-teal-700 border-jood-teal-700' : 'border-border',
                  )}>
                    {done && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>
                  <span className="text-lg flex-shrink-0">{h.icon ?? '⭐'}</span>
                  <span className="text-xs font-arabic flex-1 truncate">{h.name}</span>
                  {streak > 0 && (
                    <span className="flex items-center gap-0.5 text-[10px] text-jood-gold-500 flex-shrink-0">
                      <Flame className="w-3 h-3" />{streak}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {totalItems === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            <CalIcon className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs font-arabic">لا عناصر في هذا اليوم</p>
          </div>
        )}

        {/* Quick add row */}
        <div className="flex gap-1.5 pt-1 border-t border-border/30 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => openAdd('event')} className="h-7 text-xs gap-1 font-arabic">
            <Plus className="w-3 h-3" />حدث
          </Button>
          <Button size="sm" variant="outline" onClick={() => openAdd('task')} className="h-7 text-xs gap-1 font-arabic">
            <CheckSquare className="w-3 h-3" />مهمة
          </Button>
          <Button size="sm" variant="outline" onClick={() => openAdd('habit')} className="h-7 text-xs gap-1 font-arabic">
            <Star className="w-3 h-3" />عادة
          </Button>
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── Render ────────────────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-3">
      {/* ── Toolbar row 1: nav + title + actions ─────────────────────────────── */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {/* Navigation */}
        <Button variant="ghost" size="sm" onClick={prevPeriod} className="h-9 w-9 p-0 flex-shrink-0">
          <ChevronRight className="w-4 h-4" />
        </Button>
        <h2 className="text-sm font-bold font-arabic text-foreground min-w-0 flex-1 text-center truncate">
          {periodLabel()}
        </h2>
        <Button variant="ghost" size="sm" onClick={nextPeriod} className="h-9 w-9 p-0 flex-shrink-0">
          <ChevronLeft className="w-4 h-4" />
        </Button>

        <Button variant="outline" size="sm" onClick={jumpToday} className="h-8 font-arabic text-xs px-2.5 flex-shrink-0">اليوم</Button>

        {/* Year picker */}
        <Select value={String(viewY)} onValueChange={v => setViewY(Number(v))}>
          <SelectTrigger className="h-8 w-20 text-xs font-arabic flex-shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {YEARS.map(y => (
              <SelectItem key={y} value={String(y)} className="text-xs">{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Hijri toggle */}
        <label className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground font-arabic flex-shrink-0">
          <Moon className="w-3.5 h-3.5" /> هجري
          <Switch checked={showHijri} onCheckedChange={setShowHijri} />
        </label>

        {/* View mode */}
        <div className="flex gap-0.5 p-0.5 bg-muted/40 rounded-lg border border-border/30 flex-shrink-0">
          {([['month','LayoutGrid',LayoutGrid], ['week','Columns',Columns], ['day','AlignJustify',AlignJustify]] as const).map(([mode, , Icon]) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={cn(
                'p-1.5 rounded transition-colors',
                viewMode === mode ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="w-4 h-4" />
            </button>
          ))}
        </div>

        <Button onClick={() => openAdd('event')} size="sm" className="bg-jood-teal-900 hover:bg-jood-teal-700 text-white gap-1 font-arabic h-8 px-2.5 flex-shrink-0">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">إضافة</span>
        </Button>
      </div>

      {/* ── Toolbar row 2: month pills (scrollable on mobile) ────────────────── */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-hide">
        {AR_MONTHS.map((m, i) => (
          <button
            key={i}
            onClick={() => { setViewM(i); if (viewMode !== 'month') setViewMode('month'); }}
            className={cn(
              'text-[10px] px-2 py-1 rounded flex-shrink-0 font-arabic transition-colors',
              viewM === i && viewMode === 'month'
                ? 'bg-jood-teal-900 text-white'
                : 'text-muted-foreground hover:bg-muted bg-muted/30',
            )}
          >
            {m.slice(0, 3)}
          </button>
        ))}
        {/* Mobile hijri toggle */}
        <label className="sm:hidden flex items-center gap-1 text-[10px] text-muted-foreground font-arabic flex-shrink-0 mr-2">
          <Moon className="w-3 h-3" /> هجري
          <Switch checked={showHijri} onCheckedChange={setShowHijri} className="scale-75" />
        </label>
      </div>

      {/* ── Month View ────────────────────────────────────────────────────────── */}
      {viewMode === 'month' && (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-4">
          {/* Calendar grid */}
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="grid grid-cols-7 bg-muted/30 border-b border-border/40">
                {AR_WEEKDAYS_SHORT.map(d => (
                  <div key={d} className="p-2 text-center text-[11px] font-arabic font-semibold text-muted-foreground">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {monthGrid.map((day, i) => {
                  const inMonth = day.getMonth() === viewM;
                  const isToday_ = isSameDay(day, now);
                  const isSel = isSameDay(day, selected);
                  const ds = dateStr(day);
                  const dots = monthDots.get(ds) ?? { events: 0, tasks: 0, habits: 0, done: 0 };
                  const hijri = showHijri ? toHijri(day) : { day: '', month: '' };
                  const total = dots.events + dots.tasks + dots.habits;
                  const allDone = total > 0 && dots.done >= total;

                  return (
                    <button
                      key={i}
                      onClick={() => setSelected(day)}
                      className={cn(
                        'relative min-h-[72px] p-1.5 border-b border-l border-border/20 text-right transition-all',
                        'hover:bg-jood-teal-900/5 focus:outline-none',
                        !inMonth && 'opacity-35',
                        isSel && 'bg-jood-teal-900/10 ring-2 ring-inset ring-jood-teal-700/60',
                        allDone && inMonth && 'bg-emerald-50/50 dark:bg-emerald-950/20',
                      )}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <span className={cn(
                          'text-sm font-semibold w-6 h-6 rounded-full flex items-center justify-center',
                          isToday_ && 'bg-jood-gold-500 text-white text-xs',
                        )}>
                          {day.getDate()}
                        </span>
                        {showHijri && hijri.day && (
                          <span className="text-[8px] font-arabic text-muted-foreground/60 leading-none">{hijri.day}</span>
                        )}
                      </div>

                      {/* Compact event pills */}
                      <div className="space-y-0.5">
                        {getItems(day).events.slice(0, 1).map(e => (
                          <div key={e.id} className={cn('text-[8px] px-1 py-0.5 rounded truncate font-arabic', cat(e.category).color)}>
                            {e.title}
                          </div>
                        ))}
                      </div>

                      {/* Dot indicators */}
                      {(dots.tasks > 0 || dots.habits > 0) && (
                        <div className="flex gap-0.5 mt-0.5 flex-wrap">
                          {Array.from({ length: Math.min(dots.tasks, 3) }).map((_, j) => (
                            <span key={`t${j}`} className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                          ))}
                          {Array.from({ length: Math.min(dots.habits, 3) }).map((_, j) => (
                            <span key={`h${j}`} className="w-1.5 h-1.5 rounded-full bg-jood-teal-400 inline-block" />
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Day detail panel */}
          <Card>
            <CardContent className="p-4">
              <AnimatePresence mode="wait">
                <motion.div key={dateStr(selected)} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
                  <DayPanel day={selected} items={selectedItems} />
                </motion.div>
              </AnimatePresence>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Week View ─────────────────────────────────────────────────────────── */}
      {viewMode === 'week' && (
        <div className="space-y-3">
          <div className="grid grid-cols-7 gap-1 overflow-x-auto">
            {weekGrid.map((day, i) => {
              const isToday_ = isSameDay(day, now);
              const isSel   = isSameDay(day, selected);
              const items   = getItems(day);
              const habDone = items.habits.filter(h => items.habitLogs.some(l => l.habit_id === h.id)).length;
              const taskDone = items.tasks.filter(t => t.status === 'completed').length;
              const total   = items.habits.length + items.tasks.length;
              const pct     = total > 0 ? Math.round(((habDone + taskDone) / total) * 100) : 0;

              return (
                <button
                  key={i}
                  onClick={() => setSelected(day)}
                  className={cn(
                    'p-2 rounded-xl border border-border/30 bg-card text-right transition-all min-h-[120px] flex flex-col gap-1.5',
                    isSel && 'border-jood-teal-700/60 ring-2 ring-jood-teal-700/30',
                    isToday_ && !isSel && 'border-jood-gold-300/60',
                  )}
                >
                  {/* Day label */}
                  <div className="flex items-center justify-between">
                    <span className={cn(
                      'text-[11px] font-arabic font-semibold leading-none',
                      isToday_ ? 'text-jood-gold-500' : 'text-muted-foreground',
                    )}>
                      {AR_WEEKDAYS_SHORT[day.getDay()]}
                    </span>
                    <span className={cn(
                      'text-sm font-bold w-6 h-6 rounded-full flex items-center justify-center',
                      isToday_ && 'bg-jood-gold-500 text-white text-xs',
                    )}>
                      {day.getDate()}
                    </span>
                  </div>

                  {/* Progress bar */}
                  {total > 0 && (
                    <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-jood-teal-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  )}

                  {/* Items preview */}
                  <div className="space-y-0.5 flex-1">
                    {items.events.slice(0, 2).map(e => (
                      <div key={e.id} className={cn('text-[8px] px-1 py-0.5 rounded font-arabic truncate', cat(e.category).color)}>
                        {e.title}
                      </div>
                    ))}
                    {items.tasks.map(t => (
                      <div key={t.id} className={cn('text-[9px] font-arabic flex items-center gap-1', t.status === 'completed' && 'line-through opacity-50')}>
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                        <span className="truncate">{t.title.slice(0, 15)}</span>
                      </div>
                    ))}
                    {items.habits.slice(0, 2).map(h => {
                      const done = items.habitLogs.some(l => l.habit_id === h.id);
                      return (
                        <div key={h.id} className="text-[9px] font-arabic flex items-center gap-1">
                          <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', done ? 'bg-jood-teal-500' : 'bg-muted-foreground/30')} />
                          <span className="truncate opacity-70">{h.icon} {h.name.slice(0, 12)}</span>
                        </div>
                      );
                    })}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected day full detail */}
          <Card>
            <CardContent className="p-4">
              <DayPanel day={selected} items={selectedItems} />
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Day View ──────────────────────────────────────────────────────────── */}
      {viewMode === 'day' && (
        <Card>
          <CardContent className="p-5">
            <DayPanel day={selected} items={selectedItems} />
          </CardContent>
        </Card>
      )}

      {/* ─── Add Dialog ──────────────────────────────────────────────────────── */}
      <Dialog open={addDialog.open} onOpenChange={o => setAddDialog(s => ({ ...s, open: o }))}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="font-arabic flex items-center gap-2 text-base">
              {addDialog.type === 'event' && <><Sparkles className="w-4 h-4 text-jood-gold-500" /> حدث جديد</>}
              {addDialog.type === 'task'  && <><CheckSquare className="w-4 h-4 text-amber-500" /> مهمة جديدة</>}
              {addDialog.type === 'habit' && <><Star className="w-4 h-4 text-jood-teal-500" /> عادة جديدة</>}
            </DialogTitle>
          </DialogHeader>

          {/* Event form */}
          {addDialog.type === 'event' && (
            <div className="space-y-3">
              <div>
                <Label className="font-arabic text-xs">عبارة ذكية (اختياري)</Label>
                <Input placeholder='"كل جمعة أدفع الزكاة"' value={eventForm.nlPhrase}
                  onChange={e => setEventForm(f => ({ ...f, nlPhrase: e.target.value, title: f.title || e.target.value }))}
                  className="font-arabic text-sm mt-1" />
                {eventForm.nlPhrase && (() => {
                  const r = parseRecurrence(eventForm.nlPhrase);
                  return r.recurrence ? (
                    <p className="text-[10px] text-jood-gold-600 mt-0.5 font-arabic">✨ {RECURRENCE_LABELS[r.recurrence]}</p>
                  ) : null;
                })()}
              </div>
              <div>
                <Label className="font-arabic text-xs">العنوان *</Label>
                <Input value={eventForm.title} onChange={e => setEventForm(f => ({ ...f, title: e.target.value }))} className="font-arabic text-sm mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="font-arabic text-xs">التاريخ</Label>
                  <Input type="date" value={eventForm.date} onChange={e => setEventForm(f => ({ ...f, date: e.target.value }))} className="text-sm mt-1" />
                </div>
                <div>
                  <Label className="font-arabic text-xs">الوقت</Label>
                  <Input type="time" disabled={eventForm.all_day} value={eventForm.time} onChange={e => setEventForm(f => ({ ...f, time: e.target.value }))} className="text-sm mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="font-arabic text-xs">الفئة</Label>
                  <Select value={eventForm.category} onValueChange={v => setEventForm(f => ({ ...f, category: v }))}>
                    <SelectTrigger className="mt-1 font-arabic text-sm h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value} className="font-arabic">{c.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="font-arabic text-xs">التكرار</Label>
                  <Select value={eventForm.recurrence} onValueChange={v => setEventForm(f => ({ ...f, recurrence: v }))}>
                    <SelectTrigger className="mt-1 font-arabic text-sm h-9"><SelectValue placeholder="لا يتكرر" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="font-arabic">لا يتكرر</SelectItem>
                      <SelectItem value="daily" className="font-arabic">يومي</SelectItem>
                      <SelectItem value="weekly" className="font-arabic">أسبوعي</SelectItem>
                      <SelectItem value="monthly" className="font-arabic">شهري</SelectItem>
                      <SelectItem value="yearly" className="font-arabic">سنوي</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="font-arabic text-xs">المكان (اختياري)</Label>
                <Input value={eventForm.location} onChange={e => setEventForm(f => ({ ...f, location: e.target.value }))} className="font-arabic text-sm mt-1" />
              </div>
              <label className="flex items-center justify-between text-xs font-arabic">
                طوال اليوم
                <Switch checked={eventForm.all_day} onCheckedChange={v => setEventForm(f => ({ ...f, all_day: v }))} />
              </label>
            </div>
          )}

          {/* Task form */}
          {addDialog.type === 'task' && (
            <div className="space-y-3">
              <div>
                <Label className="font-arabic text-xs">عنوان المهمة *</Label>
                <Input value={quickTask} onChange={e => setQuickTask(e.target.value)} placeholder="مثل: مراجعة الميزانية" className="font-arabic text-sm mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="font-arabic text-xs">الأولوية</Label>
                  <Select value={quickTaskPriority} onValueChange={v => setQuickTaskPriority(v as any)}>
                    <SelectTrigger className="mt-1 font-arabic text-sm h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high" className="font-arabic">عالية 🔴</SelectItem>
                      <SelectItem value="medium" className="font-arabic">متوسطة 🟡</SelectItem>
                      <SelectItem value="low" className="font-arabic">منخفضة 🟢</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="font-arabic text-xs">التكرار</Label>
                  <Select value={quickTaskRecurrence} onValueChange={setQuickTaskRecurrence}>
                    <SelectTrigger className="mt-1 font-arabic text-sm h-9"><SelectValue placeholder="مرة واحدة" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="font-arabic">مرة واحدة</SelectItem>
                      <SelectItem value="يومي" className="font-arabic">يومي</SelectItem>
                      <SelectItem value="أسبوعي" className="font-arabic">أسبوعي</SelectItem>
                      <SelectItem value="شهري" className="font-arabic">شهري</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="font-arabic text-xs">التاريخ</Label>
                <Input type="date" value={dateStr(selected)} onChange={() => {}} className="text-sm mt-1" readOnly />
              </div>
            </div>
          )}

          {/* Habit form */}
          {addDialog.type === 'habit' && (
            <div className="space-y-3">
              <div>
                <Label className="font-arabic text-xs">اسم العادة *</Label>
                <Input value={quickHabit} onChange={e => setQuickHabit(e.target.value)} placeholder="مثل: قرأت القرآن" className="font-arabic text-sm mt-1" />
              </div>
              <div>
                <Label className="font-arabic text-xs">التكرار</Label>
                <Select value={quickHabitRecurrence} onValueChange={setQuickHabitRecurrence}>
                  <SelectTrigger className="mt-1 font-arabic text-sm h-9"><SelectValue placeholder="يومي" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily" className="font-arabic">يومي</SelectItem>
                    <SelectItem value="weekly" className="font-arabic">أسبوعي</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-[11px] text-muted-foreground font-arabic">ستظهر العادة على التقويم كل يوم لتتابعيها ✓</p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialog(s => ({ ...s, open: false }))} className="font-arabic" disabled={saving}>إلغاء</Button>
            <Button
              onClick={addDialog.type === 'event' ? saveEvent : addDialog.type === 'task' ? saveTask : saveHabit}
              className="bg-jood-teal-900 hover:bg-jood-teal-700 text-white font-arabic"
              disabled={saving}
            >
              {saving ? 'جارٍ الحفظ…' : 'حفظ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SmartCalendar;
