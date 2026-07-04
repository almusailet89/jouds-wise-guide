import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Sparkles, Target, Heart, Sliders, User2, ChevronLeft,
  ChevronRight, Check, Wallet, Briefcase, GraduationCap, Plane,
  TrendingUp, Shield, Brain, Smile, Zap,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useDatabase';
import { useLanguage } from '@/hooks/useLanguage';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────
interface FormState {
  display_name: string;
  income: number;
  goals: string[];
  risk_profile: 'conservative' | 'balanced' | 'aggressive';
  voice_first: boolean;
  language: 'ar' | 'ar-en';
  avatar_seed: number;
}

const DEFAULT: FormState = {
  display_name: '',
  income: 15000,
  goals: [],
  risk_profile: 'balanced',
  voice_first: true,
  language: 'ar',
  avatar_seed: 0,
};

// ─── Static icon/color catalogues (no text) ───────────────────────────────────
const STEP_ICONS = [User2, Target, Sliders, Sparkles, Heart] as const;
const STEP_IDS   = ['profile', 'goals', 'prefs', 'avatar', 'home'] as const;

const GOAL_META = [
  { id: 'save',        icon: Wallet,        color: 'from-emerald-500 to-emerald-700' },
  { id: 'invest',      icon: TrendingUp,    color: 'from-jood-gold-500 to-amber-700' },
  { id: 'debt',        icon: Shield,        color: 'from-rose-500 to-rose-700' },
  { id: 'house',       icon: Briefcase,     color: 'from-jood-teal-700 to-jood-teal-900' },
  { id: 'travel',      icon: Plane,         color: 'from-indigo-500 to-indigo-700' },
  { id: 'study',       icon: GraduationCap, color: 'from-violet-500 to-purple-700' },
  { id: 'wellness',    icon: Smile,         color: 'from-pink-500 to-rose-700' },
  { id: 'productivity',icon: Zap,           color: 'from-cyan-500 to-blue-700' },
] as const;

const RISK_VALUES = ['conservative', 'balanced', 'aggressive'] as const;
const RISK_EMOJIS = { conservative: '🛡️', balanced: '⚖️', aggressive: '🚀' } as const;

const AVATAR_GRADIENTS = [
  'from-jood-teal-900 to-jood-teal-700',
  'from-jood-gold-500 to-amber-700',
  'from-indigo-600 to-indigo-900',
  'from-rose-400 to-pink-700',
  'from-emerald-500 to-emerald-800',
  'from-violet-500 to-purple-800',
];

interface OnboardingProps {
  onComplete: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { toast } = useToast();
  const { t, tg, lang, dir } = useLanguage();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(DEFAULT);
  const [saving, setSaving] = useState(false);

  // ── Computed i18n arrays (inside component so t() is accessible) ─────────────
  const STEPS = STEP_IDS.map((id, i) => ({
    id,
    icon: STEP_ICONS[i],
    title: tg(`ob.step.${id}.title` as any),
    desc:  tg(`ob.step.${id}.desc` as any),
  }));

  const GOALS = GOAL_META.map(g => ({
    ...g,
    label: t(`ob.goal.${g.id}` as any),
  }));

  const RISKS = RISK_VALUES.map(v => ({
    value: v,
    label: t(`ob.risk.${v}` as any),
    desc:  t(`ob.risk.${v}.desc` as any),
    emoji: RISK_EMOJIS[v],
  }));

  const AVATARS = AVATAR_GRADIENTS.map((gradient, seed) => ({
    seed,
    gradient,
    name: t(`ob.avatar.${seed}` as any),
  }));

  // Pre-fill name from profile/auth
  useEffect(() => {
    if (profile?.display_name) setForm(f => ({ ...f, display_name: profile.display_name! }));
    else if (user?.email) setForm(f => ({ ...f, display_name: user.email!.split('@')[0] }));
  }, [profile, user]);

  // Auto-advance: step 4 ("home") finishes after 1.8s
  useEffect(() => {
    if (step === 4) {
      const timer = setTimeout(() => onComplete(), 1800);
      return () => clearTimeout(timer);
    }
  }, [step, onComplete]);

  // ── Validation per step ──────────────────────────────────────────────────────
  const canAdvance = () => {
    if (step === 0) return form.display_name.trim().length >= 2 && form.income > 0;
    if (step === 1) return form.goals.length > 0;
    return true;
  };

  // ── Save & finish ────────────────────────────────────────────────────────────
  const finish = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await (supabase as any).from('profiles').upsert({
        user_id: user.id,
        display_name: form.display_name.trim(),
        income: form.income,
        risk_profile: form.risk_profile,
        interests: form.goals,
        onboarding_done: true,
      }, { onConflict: 'user_id' });

      localStorage.setItem('jood.onboarding.done', '1');
      localStorage.setItem('jood.prefs', JSON.stringify({
        voice_first: form.voice_first,
        language: form.language,
        avatar_seed: form.avatar_seed,
      }));

      setStep(4);
    } catch (err: any) {
      toast({ title: t('ob.toast.fail'), description: err.message, variant: 'destructive' });
      setSaving(false);
    }
  };

  // ── Go forward ───────────────────────────────────────────────────────────────
  const next = () => {
    if (!canAdvance()) {
      toast({ title: t('ob.toast.req.title'), description: t('ob.toast.req.desc'), variant: 'destructive' });
      return;
    }
    if (step === 3) finish();
    else setStep(step + 1);
  };

  const back = () => setStep(Math.max(0, step - 1));

  const toggleGoal = (id: string) => {
    setForm(f => ({
      ...f,
      goals: f.goals.includes(id) ? f.goals.filter(g => g !== id) : [...f.goals, id],
    }));
  };

  const progress = ((step + 1) / STEPS.length) * 100;
  const currentAvatar = AVATARS[form.avatar_seed] ?? AVATARS[0];

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 bg-gradient-to-br from-jood-teal-900 via-jood-teal-700 to-jood-teal-900 flex items-center justify-center p-4 overflow-y-auto"
      dir={dir}
    >
      {/* Backdrop ambient particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 20 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-jood-gold-300/40"
            initial={{
              x: Math.random() * window.innerWidth,
              y: Math.random() * window.innerHeight,
              opacity: 0,
            }}
            animate={{ y: [null, -40], opacity: [0, 0.6, 0] }}
            transition={{ duration: 4 + Math.random() * 3, repeat: Infinity, delay: Math.random() * 4 }}
          />
        ))}
      </div>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-xl relative z-10"
      >
        <Card className="shadow-luxury bg-card/95 backdrop-blur">
          {/* ── Header / progress ──────────────────────────────────────────── */}
          <div className="border-b border-border/40 p-5 pb-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={cn(
                  'w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-elegant',
                  currentAvatar.gradient,
                )}>
                  <Sparkles className="w-4 h-4 text-jood-gold-300" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-arabic">جود AI</p>
                  <p className="text-sm font-bold font-arabic">{STEPS[step].title}</p>
                </div>
              </div>
              <span className="text-xs text-muted-foreground font-arabic">
                {step + 1} / {STEPS.length}
              </span>
            </div>
            <Progress value={progress} className="h-1.5" />
            <div className="flex justify-between mt-2">
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                return (
                  <div key={s.id} className="flex flex-col items-center gap-1">
                    <div className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all',
                      i < step  && 'bg-jood-teal-700 text-white',
                      i === step && 'bg-jood-gold-500 text-white scale-110 shadow-elegant',
                      i > step  && 'bg-muted text-muted-foreground',
                    )}>
                      {i < step ? <Check className="w-3 h-3" /> : <Icon className="w-3 h-3" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Body ───────────────────────────────────────────────────────── */}
          <CardContent className="p-6 min-h-[340px]">
            <AnimatePresence mode="wait">

              {/* ── Step 0: Profile ───────────────────────────────────────── */}
              {step === 0 && (
                <motion.div
                  key="step0"
                  initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4"
                >
                  <div className="text-center mb-4">
                    <h2 className="text-2xl font-bold font-arabic mb-1">{t('ob.welcome')}</h2>
                    <p className="text-xs text-muted-foreground font-arabic">{t('ob.welcome.sub')}</p>
                  </div>

                  <div>
                    <Label className="font-arabic text-xs">{t('ob.name.label')}</Label>
                    <Input
                      value={form.display_name}
                      onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
                      placeholder={t('ob.name.placeholder')}
                      className="font-arabic text-base mt-1.5"
                      autoFocus
                    />
                  </div>

                  <div>
                    <Label className="font-arabic text-xs">{t('ob.income.label')}</Label>
                    <Input
                      type="number"
                      value={form.income || ''}
                      onChange={e => setForm(f => ({ ...f, income: Number(e.target.value) || 0 }))}
                      placeholder="15000"
                      className="font-mono text-base mt-1.5"
                    />
                    <p className="text-[10px] text-muted-foreground font-arabic mt-1">{t('ob.income.hint')}</p>
                  </div>
                </motion.div>
              )}

              {/* ── Step 1: Goals ─────────────────────────────────────────── */}
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="text-center mb-4">
                    <h2 className="text-xl font-bold font-arabic mb-1">{t('ob.goals.title')}</h2>
                    <p className="text-xs text-muted-foreground font-arabic">{tg('ob.goals.sub')}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {GOALS.map(g => {
                      const Icon = g.icon;
                      const on = form.goals.includes(g.id);
                      return (
                        <button
                          key={g.id}
                          onClick={() => toggleGoal(g.id)}
                          className={cn(
                            'p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1.5 text-center',
                            on ? 'border-jood-teal-700 bg-jood-teal-900/5 scale-105'
                               : 'border-border/40 hover:border-jood-teal-500/50',
                          )}
                        >
                          <div className={cn('w-9 h-9 rounded-lg bg-gradient-to-br flex items-center justify-center', g.color)}>
                            <Icon className="w-4 h-4 text-white" />
                          </div>
                          <span className="text-xs font-arabic font-semibold">{g.label}</span>
                          {on && <Check className="w-3 h-3 text-jood-teal-700" />}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-center text-muted-foreground font-arabic mt-3">
                    {tg('ob.goals.min')}
                  </p>
                </motion.div>
              )}

              {/* ── Step 2: Prefs ─────────────────────────────────────────── */}
              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-5"
                >
                  <div className="text-center mb-2">
                    <h2 className="text-xl font-bold font-arabic mb-1">{t('ob.prefs.title')}</h2>
                    <p className="text-xs text-muted-foreground font-arabic">{t('ob.prefs.sub')}</p>
                  </div>

                  {/* Risk profile */}
                  <div>
                    <Label className="font-arabic text-xs mb-2 block">{t('ob.risk.label')}</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {RISKS.map(r => (
                        <button
                          key={r.value}
                          onClick={() => setForm(f => ({ ...f, risk_profile: r.value }))}
                          className={cn(
                            'p-3 rounded-xl border-2 text-center transition-all',
                            form.risk_profile === r.value
                              ? 'border-jood-gold-500 bg-jood-gold-500/10'
                              : 'border-border/40 hover:border-jood-gold-500/40',
                          )}
                        >
                          <div className="text-2xl mb-1">{r.emoji}</div>
                          <div className="text-xs font-arabic font-bold">{r.label}</div>
                          <div className="text-[9px] text-muted-foreground font-arabic">{r.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Voice-first */}
                  <div>
                    <Label className="font-arabic text-xs mb-2 block">{t('ob.voice.label')}</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setForm(f => ({ ...f, voice_first: true }))}
                        className={cn(
                          'p-3 rounded-xl border-2 transition-all',
                          form.voice_first ? 'border-jood-teal-700 bg-jood-teal-900/5' : 'border-border/40',
                        )}
                      >
                        <div className="text-xl mb-1">🎙️</div>
                        <div className="text-xs font-arabic font-bold">{t('ob.voice.first')}</div>
                      </button>
                      <button
                        onClick={() => setForm(f => ({ ...f, voice_first: false }))}
                        className={cn(
                          'p-3 rounded-xl border-2 transition-all',
                          !form.voice_first ? 'border-jood-teal-700 bg-jood-teal-900/5' : 'border-border/40',
                        )}
                      >
                        <div className="text-xl mb-1">⌨️</div>
                        <div className="text-xs font-arabic font-bold">{t('ob.voice.text')}</div>
                      </button>
                    </div>
                  </div>

                  {/* Language */}
                  <div>
                    <Label className="font-arabic text-xs mb-2 block">{t('ob.lang.label')}</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setForm(f => ({ ...f, language: 'ar' }))}
                        className={cn(
                          'p-2.5 rounded-xl border-2 text-xs font-arabic transition-all',
                          form.language === 'ar' ? 'border-jood-teal-700 bg-jood-teal-900/5' : 'border-border/40',
                        )}
                      >
                        {t('ob.lang.ar')}
                      </button>
                      <button
                        onClick={() => setForm(f => ({ ...f, language: 'ar-en' }))}
                        className={cn(
                          'p-2.5 rounded-xl border-2 text-xs font-arabic transition-all',
                          form.language === 'ar-en' ? 'border-jood-teal-700 bg-jood-teal-900/5' : 'border-border/40',
                        )}
                      >
                        {t('ob.lang.mixed')}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── Step 3: Avatar ────────────────────────────────────────── */}
              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="text-center mb-4">
                    <h2 className="text-xl font-bold font-arabic mb-1">{tg('ob.avatar.title')}</h2>
                    <p className="text-xs text-muted-foreground font-arabic">{t('ob.avatar.sub')}</p>
                  </div>

                  {/* Live preview */}
                  <div className="flex justify-center mb-5">
                    <motion.div
                      key={form.avatar_seed}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.3 }}
                      className={cn(
                        'w-24 h-24 rounded-full flex items-center justify-center shadow-luxury bg-gradient-to-br',
                        currentAvatar.gradient,
                      )}
                    >
                      <span className="text-4xl font-display text-white">ج</span>
                    </motion.div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {AVATARS.map(a => (
                      <button
                        key={a.seed}
                        onClick={() => setForm(f => ({ ...f, avatar_seed: a.seed }))}
                        className={cn(
                          'p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1',
                          form.avatar_seed === a.seed
                            ? 'border-jood-gold-500 bg-jood-gold-500/10 scale-105'
                            : 'border-border/40 hover:border-jood-gold-500/40',
                        )}
                      >
                        <div className={cn('w-10 h-10 rounded-full bg-gradient-to-br flex items-center justify-center', a.gradient)}>
                          <span className="text-base font-display text-white">ج</span>
                        </div>
                        <span className="text-[10px] font-arabic">{a.name}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* ── Step 4: Done ──────────────────────────────────────────── */}
              {step === 4 && (
                <motion.div
                  key="step4"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5 }}
                  className="flex flex-col items-center justify-center py-12 text-center"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: [0, 1.2, 1] }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    className={cn(
                      'w-24 h-24 rounded-full bg-gradient-to-br flex items-center justify-center shadow-luxury mb-4',
                      currentAvatar.gradient,
                    )}
                  >
                    <Check className="w-10 h-10 text-jood-gold-300" />
                  </motion.div>
                  <h2 className="text-2xl font-bold font-arabic mb-2">
                    {t('ob.done.greeting')} {form.display_name.split(' ')[0]} 🌟
                  </h2>
                  <p className="text-sm text-muted-foreground font-arabic max-w-xs leading-relaxed">
                    {t('ob.done.sub')}
                  </p>
                </motion.div>
              )}

            </AnimatePresence>
          </CardContent>

          {/* ── Footer (hidden on done step) ───────────────────────────────── */}
          {step < 4 && (
            <div className="border-t border-border/40 p-4 flex items-center justify-between gap-3">
              <Button
                variant="ghost"
                onClick={back}
                disabled={step === 0}
                className="font-arabic gap-1 text-muted-foreground"
              >
                {lang === 'ar' ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                {t('ob.nav.back')}
              </Button>
              <Button
                onClick={next}
                disabled={!canAdvance() || saving}
                className="bg-gradient-to-r from-jood-teal-900 to-jood-teal-700 hover:from-jood-teal-700 hover:to-jood-teal-900 text-white font-arabic gap-1"
              >
                {step === 3
                  ? (saving ? t('ob.nav.saving') : t('ob.nav.finish'))
                  : t('ob.nav.next')}
                {lang === 'ar' ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </Button>
            </div>
          )}
        </Card>
      </motion.div>
    </div>
  );
};

export default Onboarding;
