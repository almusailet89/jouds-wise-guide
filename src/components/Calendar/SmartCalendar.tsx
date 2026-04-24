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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  ChevronLeft, ChevronRight, Plus, Calendar as CalIcon, Moon,
  Trash2, Repeat, MapPin, Bell, Sparkles, Wand2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────
interface EventRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  category: string;
  color: string | null;
  location: string | null;
  recurrence: string | null;
  hijri_anchor: boolean;
  reminder_min: number | null;
  prayer_linked: string | null;
  source: string;
  completed_at: string | null;
  created_at: string;
}

// ─── Categories ───────────────────────────────────────────────────────────────
const CATEGORIES = [
  { value: 'personal',  label: 'شخصي',     color: 'bg-jood-teal-700 text-white' },
  { value: 'finance',   label: 'مالي',      color: 'bg-jood-gold-500 text-white' },
  { value: 'health',    label: 'صحة',       color: 'bg-emerald-600 text-white' },
  { value: 'prayer',    label: 'ديني',      color: 'bg-indigo-600 text-white' },
  { value: 'family',    label: 'عائلة',     color: 'bg-rose-500 text-white' },
  { value: 'work',      label: 'عمل',       color: 'bg-slate-700 text-white' },
];

const cat = (v: string) => CATEGORIES.find(c => c.value === v) ?? CATEGORIES[0];

// ─── Arabic month names ───────────────────────────────────────────────────────
const AR_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];
const AR_WEEKDAYS = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

// ─── Hijri helper ─────────────────────────────────────────────────────────────
const toHijri = (d: Date): { day: string; month: string } => {
  try {
    const fmt = new Intl.DateTimeFormat('ar-SA-u-ca-islamic', {
      day: 'numeric', month: 'long',
    });
    const parts = fmt.formatToParts(d);
    const day = parts.find(p => p.type === 'day')?.value ?? '';
    const month = parts.find(p => p.type === 'month')?.value ?? '';
    return { day, month };
  } catch {
    return { day: '', month: '' };
  }
};

// ─── Arabic natural-language recurrence parser ────────────────────────────────
// Recognizes patterns like:
//   "كل جمعة" → weekly (Friday)
//   "كل يوم" / "يوميا" → daily
//   "كل شهر" / "شهريا" → monthly
//   "كل سنة" / "سنويا" → yearly
// Returns { recurrence, note } where recurrence ∈ daily|weekly|monthly|yearly|null
const parseRecurrence = (text: string): { recurrence: string | null; hijri: boolean } => {
  const t = text.trim();
  const hijri = /هجري|هلالي|رمضان|شعبان|محرم|صفر|ربيع|جمادى|رجب|ذو/i.test(t);
  if (/يوميا|كل\s*يوم/.test(t)) return { recurrence: 'daily', hijri };
  if (/اسبوعيا|أسبوعيا|كل\s*(جمعة|سبت|أحد|اثنين|ثلاثاء|أربعاء|خميس|أسبوع)/.test(t))
    return { recurrence: 'weekly', hijri };
  if (/شهريا|كل\s*شهر/.test(t)) return { recurrence: 'monthly', hijri };
  if (/سنويا|كل\s*(سنة|عام)/.test(t)) return { recurrence: 'yearly', hijri };
  return { recurrence: null, hijri };
};

// ─── Build month grid (Sunday-first, 6 weeks = 42 cells) ──────────────────────
const buildGrid = (year: number, month: number): Date[] => {
  const first = new Date(year, month, 1);
  const offset = first.getDay(); // 0..6 (Sun..Sat)
  const start = new Date(year, month, 1 - offset);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
};

// ─── Recurring event matching ─────────────────────────────────────────────────
const occursOn = (e: EventRow, day: Date): boolean => {
  const s = new Date(e.starts_at);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(s, day)) return true;
  if (day < s) return false;

  switch (e.recurrence) {
    case 'daily':   return true;
    case 'weekly':  return s.getDay() === day.getDay();
    case 'monthly': return s.getDate() === day.getDate();
    case 'yearly':  return s.getDate() === day.getDate() && s.getMonth() === day.getMonth();
    default:        return false;
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// ─── Component ────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
export const SmartCalendar: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const now = new Date();
  const [viewY, setViewY] = useState(now.getFullYear());
  const [viewM, setViewM] = useState(now.getMonth());
  const [selected, setSelected] = useState<Date>(now);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHijri, setShowHijri] = useState(true);

  // Dialog state
  const [openNew, setOpenNew] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', date: '', time: '09:00',
    category: 'personal', all_day: false, location: '',
    reminder_min: 15, nlPhrase: '',
  });

  // ── Load events ──────────────────────────────────────────────────────────────
  const loadEvents = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('events')
      .select('*')
      .eq('user_id', user.id)
      .order('starts_at', { ascending: true });
    if (!error && data) setEvents(data as EventRow[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  // ── Build grid ───────────────────────────────────────────────────────────────
  const grid = useMemo(() => buildGrid(viewY, viewM), [viewY, viewM]);

  // ── Events grouped by date key ───────────────────────────────────────────────
  const eventsByDay = useMemo(() => {
    const map = new Map<string, EventRow[]>();
    grid.forEach(d => {
      const key = d.toISOString().split('T')[0];
      const list = events.filter(e => occursOn(e, d));
      if (list.length) map.set(key, list);
    });
    return map;
  }, [events, grid]);

  const selectedEvents = useMemo(() => {
    const key = selected.toISOString().split('T')[0];
    return eventsByDay.get(key) ?? [];
  }, [eventsByDay, selected]);

  // ── Navigation ───────────────────────────────────────────────────────────────
  const prevMonth = () => {
    if (viewM === 0) { setViewY(viewY - 1); setViewM(11); }
    else setViewM(viewM - 1);
  };
  const nextMonth = () => {
    if (viewM === 11) { setViewY(viewY + 1); setViewM(0); }
    else setViewM(viewM + 1);
  };
  const jumpToday = () => {
    const t = new Date();
    setViewY(t.getFullYear()); setViewM(t.getMonth()); setSelected(t);
  };

  // ── Open dialog ──────────────────────────────────────────────────────────────
  const openCreate = () => {
    setForm({
      title: '', description: '',
      date: selected.toISOString().split('T')[0],
      time: '09:00', category: 'personal', all_day: false,
      location: '', reminder_min: 15, nlPhrase: '',
    });
    setOpenNew(true);
  };

  // ── Create event ─────────────────────────────────────────────────────────────
  const saveEvent = async () => {
    if (!user || !form.title.trim() || !form.date) {
      toast({ title: 'أكملي البيانات', description: 'العنوان والتاريخ مطلوبان', variant: 'destructive' });
      return;
    }

    const parsed = parseRecurrence(form.nlPhrase || form.title);
    const startsAt = form.all_day
      ? new Date(`${form.date}T00:00:00`).toISOString()
      : new Date(`${form.date}T${form.time}:00`).toISOString();

    const { error } = await (supabase as any).from('events').insert({
      user_id: user.id,
      title: form.title.trim(),
      description: form.description.trim() || null,
      starts_at: startsAt,
      all_day: form.all_day,
      category: form.category,
      location: form.location.trim() || null,
      recurrence: parsed.recurrence,
      hijri_anchor: parsed.hijri,
      reminder_min: form.reminder_min || null,
      source: form.nlPhrase ? 'nlu' : 'user',
    });

    if (error) {
      toast({ title: 'تعذر الحفظ', description: error.message, variant: 'destructive' });
      return;
    }

    toast({
      title: parsed.recurrence ? 'حدث متكرر ✨' : 'تم الحفظ ✓',
      description: parsed.recurrence ? `تكرار: ${parsed.recurrence}` : undefined,
    });
    setOpenNew(false);
    loadEvents();
  };

  // ── Delete event ─────────────────────────────────────────────────────────────
  const deleteEvent = async (id: string) => {
    const { error } = await (supabase as any).from('events').delete().eq('id', id);
    if (error) {
      toast({ title: 'تعذر الحذف', variant: 'destructive' });
      return;
    }
    setEvents(prev => prev.filter(e => e.id !== id));
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  const today = new Date();
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  return (
    <div className="space-y-5">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={prevMonth} className="h-9 w-9 p-0">
            <ChevronRight className="w-4 h-4" />
          </Button>
          <h2 className="text-xl font-bold font-arabic text-foreground min-w-[140px] text-center">
            {AR_MONTHS[viewM]} {viewY}
          </h2>
          <Button variant="ghost" size="sm" onClick={nextMonth} className="h-9 w-9 p-0">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={jumpToday} className="h-9 font-arabic mr-2">
            اليوم
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground font-arabic">
            <Moon className="w-3.5 h-3.5" />
            التقويم الهجري
            <Switch checked={showHijri} onCheckedChange={setShowHijri} />
          </label>
          <Button onClick={openCreate} size="sm" className="bg-jood-teal-900 hover:bg-jood-teal-700 text-white gap-1.5 font-arabic">
            <Plus className="w-4 h-4" /> حدث جديد
          </Button>
        </div>
      </div>

      {/* ── Grid ────────────────────────────────────────────────────────────── */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {/* Weekdays header */}
          <div className="grid grid-cols-7 bg-muted/30 border-b border-border/40">
            {AR_WEEKDAYS.map(d => (
              <div key={d} className="p-2 text-center text-[11px] font-arabic font-semibold text-muted-foreground">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 auto-rows-fr">
            {grid.map((day, i) => {
              const inMonth = day.getMonth() === viewM;
              const isToday = isSameDay(day, today);
              const isSelected = isSameDay(day, selected);
              const key = day.toISOString().split('T')[0];
              const dayEvents = eventsByDay.get(key) ?? [];
              const hijri = showHijri ? toHijri(day) : { day: '', month: '' };

              return (
                <button
                  key={i}
                  onClick={() => setSelected(day)}
                  className={cn(
                    'relative min-h-[78px] p-1.5 border-b border-l border-border/30 text-right transition-all',
                    'hover:bg-jood-teal-900/5 focus:outline-none focus:bg-jood-teal-900/10',
                    !inMonth && 'bg-muted/20 text-muted-foreground/50',
                    isSelected && 'bg-jood-teal-900/10 ring-2 ring-inset ring-jood-teal-700',
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className={cn(
                      'text-sm font-semibold w-6 h-6 rounded-full flex items-center justify-center',
                      isToday && 'bg-jood-gold-500 text-white',
                    )}>
                      {day.getDate()}
                    </div>
                    {showHijri && hijri.day && (
                      <span className="text-[9px] font-arabic text-muted-foreground/70 leading-none mt-1">
                        {hijri.day}
                      </span>
                    )}
                  </div>
                  {/* Event pills */}
                  <div className="mt-1 space-y-0.5">
                    {dayEvents.slice(0, 2).map(e => (
                      <div
                        key={e.id}
                        className={cn(
                          'text-[9px] px-1.5 py-0.5 rounded truncate font-arabic',
                          cat(e.category).color,
                        )}
                      >
                        {e.recurrence && <Repeat className="w-2 h-2 inline ml-0.5" />}
                        {e.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="text-[9px] text-muted-foreground font-arabic">
                        +{dayEvents.length - 2} أخرى
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Selected-day detail ────────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-base font-bold font-arabic">
                {selected.getDate()} {AR_MONTHS[selected.getMonth()]} {selected.getFullYear()}
              </h3>
              {showHijri && (
                <p className="text-[11px] text-muted-foreground font-arabic mt-0.5 flex items-center gap-1">
                  <Moon className="w-3 h-3" />
                  {toHijri(selected).day} {toHijri(selected).month}
                </p>
              )}
            </div>
            <Badge variant="outline" className="font-arabic text-[11px]">
              {selectedEvents.length} حدث
            </Badge>
          </div>

          {loading ? (
            <div className="text-center text-muted-foreground text-xs font-arabic py-6">جارٍ التحميل…</div>
          ) : selectedEvents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CalIcon className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-xs font-arabic">لا أحداث في هذا اليوم</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={openCreate}
                className="mt-2 font-arabic text-xs text-jood-teal-700"
              >
                <Plus className="w-3.5 h-3.5 ml-1" /> أضيفي حدثاً
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence>
                {selectedEvents.map(e => (
                  <motion.div
                    key={e.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="flex items-start justify-between gap-3 p-3 rounded-xl border border-border/40 hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-arabic', cat(e.category).color)}>
                          {cat(e.category).label}
                        </span>
                        {e.recurrence && (
                          <Badge variant="outline" className="text-[9px] font-arabic gap-0.5">
                            <Repeat className="w-2.5 h-2.5" />
                            {e.recurrence === 'daily'   && 'يومي'}
                            {e.recurrence === 'weekly'  && 'أسبوعي'}
                            {e.recurrence === 'monthly' && 'شهري'}
                            {e.recurrence === 'yearly'  && 'سنوي'}
                          </Badge>
                        )}
                        {e.hijri_anchor && (
                          <Badge variant="outline" className="text-[9px] font-arabic gap-0.5">
                            <Moon className="w-2.5 h-2.5" /> هجري
                          </Badge>
                        )}
                        {e.source === 'nlu' && (
                          <Badge variant="outline" className="text-[9px] font-arabic gap-0.5 text-jood-gold-700 border-jood-gold-300">
                            <Wand2 className="w-2.5 h-2.5" /> ذكي
                          </Badge>
                        )}
                      </div>
                      <h4 className="font-semibold text-sm font-arabic text-foreground">{e.title}</h4>
                      {e.description && (
                        <p className="text-xs text-muted-foreground font-arabic mt-0.5 line-clamp-2">{e.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground font-arabic">
                        {!e.all_day && (
                          <span>⏰ {new Date(e.starts_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</span>
                        )}
                        {e.all_day && <span>🗓️ طوال اليوم</span>}
                        {e.location && <span className="flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" /> {e.location}</span>}
                        {e.reminder_min && <span className="flex items-center gap-0.5"><Bell className="w-2.5 h-2.5" /> {e.reminder_min}د</span>}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteEvent(e.id)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── New Event Dialog ───────────────────────────────────────────────── */}
      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="font-arabic flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-jood-gold-500" /> حدث جديد
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {/* NL phrase */}
            <div>
              <Label className="font-arabic text-xs flex items-center gap-1">
                <Wand2 className="w-3 h-3" /> عبارة ذكية (اختياري)
              </Label>
              <Input
                placeholder='مثل: "كل جمعة أدفع الزكاة"'
                value={form.nlPhrase}
                onChange={e => setForm(f => ({ ...f, nlPhrase: e.target.value, title: f.title || e.target.value }))}
                className="font-arabic text-sm mt-1"
              />
              {form.nlPhrase && (
                <p className="text-[10px] text-jood-gold-700 mt-1 font-arabic">
                  {(() => {
                    const r = parseRecurrence(form.nlPhrase);
                    if (!r.recurrence) return 'حدث مرة واحدة';
                    const map: Record<string, string> = {
                      daily: 'تكرار يومي', weekly: 'تكرار أسبوعي',
                      monthly: 'تكرار شهري', yearly: 'تكرار سنوي',
                    };
                    return `✨ ${map[r.recurrence]}${r.hijri ? ' (هجري)' : ''}`;
                  })()}
                </p>
              )}
            </div>

            <div>
              <Label className="font-arabic text-xs">العنوان</Label>
              <Input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="font-arabic text-sm mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="font-arabic text-xs">التاريخ</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="text-sm mt-1"
                />
              </div>
              <div>
                <Label className="font-arabic text-xs">الوقت</Label>
                <Input
                  type="time"
                  disabled={form.all_day}
                  value={form.time}
                  onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                  className="text-sm mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="font-arabic text-xs">الفئة</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger className="mt-1 font-arabic text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c.value} value={c.value} className="font-arabic">{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="font-arabic text-xs">تذكير (دقائق)</Label>
                <Input
                  type="number" min={0} max={1440}
                  value={form.reminder_min}
                  onChange={e => setForm(f => ({ ...f, reminder_min: Number(e.target.value) || 0 }))}
                  className="text-sm mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="font-arabic text-xs">المكان (اختياري)</Label>
              <Input
                value={form.location}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                className="font-arabic text-sm mt-1"
              />
            </div>

            <div>
              <Label className="font-arabic text-xs">وصف (اختياري)</Label>
              <Textarea
                rows={2}
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="font-arabic text-sm mt-1"
              />
            </div>

            <label className="flex items-center justify-between text-xs font-arabic">
              طوال اليوم
              <Switch
                checked={form.all_day}
                onCheckedChange={v => setForm(f => ({ ...f, all_day: v }))}
              />
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNew(false)} className="font-arabic">إلغاء</Button>
            <Button onClick={saveEvent} className="bg-jood-teal-900 hover:bg-jood-teal-700 text-white font-arabic">
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SmartCalendar;
