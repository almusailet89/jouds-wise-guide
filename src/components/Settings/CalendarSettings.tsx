import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, Save, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// JS Date.getDay(): 0=Sun, 6=Sat. Saudi default work week = Sun-Thu.
const DAYS = [
  { idx: 0, ar: 'الأحد',     short: 'أ' },
  { idx: 1, ar: 'الإثنين',  short: 'إ' },
  { idx: 2, ar: 'الثلاثاء', short: 'ث' },
  { idx: 3, ar: 'الأربعاء', short: 'ر' },
  { idx: 4, ar: 'الخميس',   short: 'خ' },
  { idx: 5, ar: 'الجمعة',   short: 'ج' },
  { idx: 6, ar: 'السبت',    short: 'س' },
];

const SAUDI_DEFAULTS = { working_days: [0,1,2,3,4], weekend_days: [5,6], week_start_day: 0 };

const CalendarSettings: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [working, setWorking]   = useState<number[]>(SAUDI_DEFAULTS.working_days);
  const [weekend, setWeekend]   = useState<number[]>(SAUDI_DEFAULTS.weekend_days);
  const [weekStart, setWeekStart] = useState<number>(SAUDI_DEFAULTS.week_start_day);

  // ── Load current settings ─────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from('profiles')
        .select('working_days, weekend_days, week_start_day')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        setWorking(Array.isArray(data.working_days) ? data.working_days : SAUDI_DEFAULTS.working_days);
        setWeekend(Array.isArray(data.weekend_days) ? data.weekend_days : SAUDI_DEFAULTS.weekend_days);
        setWeekStart(typeof data.week_start_day === 'number' ? data.week_start_day : SAUDI_DEFAULTS.week_start_day);
      }
      setLoading(false);
    })();
  }, [user?.id]);

  // ── Toggle a day between working/weekend (mutually exclusive) ─────────────
  const toggleDay = (dayIdx: number) => {
    if (working.includes(dayIdx)) {
      // Move from working → weekend
      setWorking(working.filter(d => d !== dayIdx));
      setWeekend([...weekend.filter(d => d !== dayIdx), dayIdx].sort());
    } else {
      // Move from weekend → working
      setWeekend(weekend.filter(d => d !== dayIdx));
      setWorking([...working.filter(d => d !== dayIdx), dayIdx].sort());
    }
  };

  const resetToSaudi = () => {
    setWorking(SAUDI_DEFAULTS.working_days);
    setWeekend(SAUDI_DEFAULTS.weekend_days);
    setWeekStart(SAUDI_DEFAULTS.week_start_day);
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await (supabase as any)
      .from('profiles')
      .update({ working_days: working, weekend_days: weekend, week_start_day: weekStart })
      .eq('user_id', user.id);
    setSaving(false);
    if (error) {
      toast({ title: 'فشل الحفظ', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'تم الحفظ', description: 'إعدادات التقويم محدّثة' });
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-center text-muted-foreground font-arabic text-sm">
        جاري التحميل...
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5 p-4 rounded-2xl bg-card border border-border/30"
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <CalendarDays className="w-5 h-5 text-jood-teal-500" />
        <h3 className="font-arabic font-semibold text-base">إعدادات التقويم وأسبوع العمل</h3>
      </div>

      {/* Working / Weekend split */}
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground font-arabic">
          اضغطي على اليوم لتبديله بين أيام العمل والإجازة. الافتراضي السعودي: الأحد-الخميس عمل، الجمعة-السبت إجازة.
        </p>

        <div className="grid grid-cols-7 gap-1.5">
          {DAYS.map(d => {
            const isWorking = working.includes(d.idx);
            return (
              <button
                key={d.idx}
                onClick={() => toggleDay(d.idx)}
                className={cn(
                  'flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all',
                  isWorking
                    ? 'bg-jood-teal-500/10 border-jood-teal-500/40 text-jood-teal-700'
                    : 'bg-jood-gold-500/10 border-jood-gold-500/40 text-jood-gold-700',
                )}
              >
                <span className="text-[10px] font-arabic font-medium">{d.ar}</span>
                <span className="text-[9px] opacity-70 font-arabic">
                  {isWorking ? 'عمل' : 'إجازة'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Week start day */}
      <div className="space-y-2">
        <label className="text-xs font-arabic text-muted-foreground">أول أيام الأسبوع في التقويم</label>
        <div className="flex gap-1.5 flex-wrap">
          {DAYS.map(d => (
            <button
              key={d.idx}
              onClick={() => setWeekStart(d.idx)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-arabic transition-all border',
                weekStart === d.idx
                  ? 'bg-jood-teal-500 text-white border-jood-teal-500 font-semibold'
                  : 'bg-muted/30 border-border/30 text-muted-foreground hover:text-foreground',
              )}
            >
              {d.ar}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t border-border/20">
        <Button
          variant="outline"
          size="sm"
          onClick={resetToSaudi}
          className="font-arabic gap-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          الافتراضي السعودي
        </Button>
        <Button
          size="sm"
          onClick={save}
          disabled={saving}
          className="font-arabic gap-1.5 bg-jood-teal-500 hover:bg-jood-teal-600 text-white"
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? 'يحفظ...' : 'حفظ'}
        </Button>
      </div>
    </motion.div>
  );
};

export default CalendarSettings;
