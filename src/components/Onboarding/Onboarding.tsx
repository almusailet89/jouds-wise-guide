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

// ─── Step config ──────────────────────────────────────────────────────────────
const STEPS = [
  { id: 'profile',  icon: User2,    title: 'مرحباً بك',       desc: 'تعارف سريع' },
  { id: 'goals',    icon: Target,   title: 'أهدافك',          desc: 'ماذا تريدين تحقيقه؟' },
  { id: 'prefs',    icon: Sliders,  title: 'تفضيلاتك',        desc: 'كيف نتواصل؟' },
  { id: 'avatar',   icon: Sparkles, title: 'اختاري شخصيتها',  desc: 'وجه جود' },
  { id: 'home',     icon: Heart,    title: 'كل شيء جاهز',     desc: 'هيا نبدأ' },
] as const;

// ─── Goals catalogue ──────────────────────────────────────────────────────────
const GOALS = [
  { id: 'save',     label: 'ادخار شهري',       icon: Wallet,        color: 'from-emerald-500 to-emerald-700' },
  { id: 'invest',   label: 'استثمار وتنمية',    icon: TrendingUp,    color: 'from-jood-gold-500 to-amber-700' },
  { id: 'debt',     label: 'سداد الديون',      icon: Shield,        color: 'from-rose-500 to-rose-700' },
  { id: 'house',    label: 'تملّك منزل',       icon: Briefcase,     color: 'from-jood-teal-700 to-jood-teal-900' },
  { id: 'travel',   label: 'سفر/عمرة',         icon: Plane,         color: 'from-indigo-500 to-indigo-700' },
  { id: 'study',    label: 'تعليم وتطوير',     icon: GraduationCap, color: 'from-violet-500 to-purple-700' },
  { id: 'wellness', label: 'صحة ومزاج',        icon: Smile,         color: 'from-pink-500 to-rose-700' },
  { id: 'productivity', label: 'إنتاجية',     icon: Zap,           color: 'from-cyan-500 to-blue-700' },
];

// ─── Risk profile ─────────────────────────────────────────────────────────────
const RISKS = [
  { value: 'conservative', label: 'حذرة',    desc: 'صكوك وودائع', emoji: '🛡️' },
  { value: 'balanced',     label: 'متوازنة', desc: 'مزيج معقول',  emoji: '⚖️' },
  { value: 'aggressive',   label: 'نشطة',    desc: 'فرص للنمو',   emoji: '🚀' },
] as const;

// ─── Avatar palette (just gradients/seeds) ────────────────────────────────────
const AVATARS = [
  { seed: 0, name: 'أصيل',   gradient: 'from-jood-teal-900 to-jood-teal-700' },
  { seed: 1, name: 'ذهبي',   gradient: 'from-jood-gold-500 to-amber-700' },
  { seed: 2, name: 'هادئ',   gradient: 'from-indigo-600 to-indigo-900' },
  { seed: 3, name: 'وردي',   gradient: 'from-rose-400 to-pink-700' },
  { seed: 4, name: 'أخضر',   gradient: 'from-emerald-500 to-emerald-800' },
  { seed: 5, name: 'بنفسجي', gradient: 'from-violet-500 to-purple-800' },
];

interface OnboardingProps {
  onComplete: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(DEFAULT);
  const [saving, setSaving] = useState(false);

  // Pre-fill name from profile/auth
  useEffect(() => {
    if (profile?.display_name) setForm(f => ({ ...f, display_name: profile.display_name! }));
    else if (user?.email) setForm(f => ({ ...f, display_name: user.email!.split('@')[0] }));
  }, [profile, user]);

  // Auto-advance: step 4 ("home") finishes after 1.8s
  useEffect(() => {
    if (step === 4) {
      const t = setTimeout(() => onComplete(), 1800);
      return () => clearTimeout(t);
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
      // Upsert profile
      await (supabase as any).from('profiles').upsert({
        user_id: user.id,
        display_name: form.display_name.trim(),
        income: form.income,
        risk_profile: form.risk_profile,
        interests: form.goals,
      }, { onConflict: 'user_id' });

      // Persist UI prefs locally
      localStorage.setItem('jood.onboarding.done', '1');
      localStorage.setItem('jood.prefs', JSON.stringify({
        voice_first: form.voice_first,
        language: form.language,
        avatar_seed: form.avatar_seed,
      }));

      // Move to celebration screen
      setStep(4);
    } catch (err: any) {
      toast({ title: 'تعذر الحفظ', description: err.message, variant: 'destructive' });
      setSaving(false);
    }
  };

  // ── Go forward ───────────────────────────────────────────────────────────────
  const next = () => {
    if (!canAdvance()) {
      toast({ title: 'أكملي البيانات', description: 'الحقول المطلوبة فارغة', variant: 'destructive' });
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
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-jood-teal-900 via-jood-teal-700 to-jood-teal-900 flex items-center justify-center p-4 overflow-y-auto" dir="rtl">
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
            animate={{
              y: [null, -40],
              opacity: [0, 0.6, 0],
            }}
            transition={{
              duration: 4 + Math.random() * 3,
              repeat: Infinity,
              delay: Math.random() * 4,
            }}
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
                      i < step && 'bg-jood-teal-700 text-white',
                      i === step && 'bg-jood-gold-500 text-white scale-110 shadow-elegant',
                      i > step && 'bg-muted text-muted-foreground',
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
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4"
                >
                  <div className="text-center mb-4">
                    <h2 className="text-2xl font-bold font-arabic mb-1">أهلاً بك في جود ✨</h2>
                    <p className="text-xs text-muted-foreground font-arabic">
                      دعينا نتعرف عليكِ في أقل من ٩٠ ثانية.
                    </p>
                  </div>

                  <div>
                    <Label className="font-arabic text-xs">اسمك (للترحيب)</Label>
                    <Input
                      value={form.display_name}
                      onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
                      placeholder="سارة"
                      className="font-arabic text-base mt-1.5"
                      autoFocus
                    />
                  </div>

                  <div>
                    <Label className="font-arabic text-xs">الدخل الشهري التقريبي (ر.س)</Label>
                    <Input
                      type="number"
                      value={form.income || ''}
                      onChange={e => setForm(f => ({ ...f, income: Number(e.target.value) || 0 }))}
                      placeholder="15000"
                      className="font-mono text-base mt-1.5"
                    />
                    <p className="text-[10px] text-muted-foreground font-arabic mt-1">
                      نستخدمها لتقديم نصائح دقيقة — تبقى خاصة بك تماماً.
                    </p>
                  </div>
                </motion.div>
              )}

              {/* ── Step 1: Goals ─────────────────────────────────────────── */}
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="text-center mb-4">
                    <h2 className="text-xl font-bold font-arabic mb-1">ما الذي يهمك؟</h2>
                    <p className="text-xs text-muted-foreground font-arabic">
                      اختاري واحداً أو أكثر — يمكنك تعديلها لاحقاً.
                    </p>
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
                            on
                              ? 'border-jood-teal-700 bg-jood-teal-900/5 scale-105'
                              : 'border-border/40 hover:border-jood-teal-500/50',
                          )}
                        >
                          <div className={cn(
                            'w-9 h-9 rounded-lg bg-gradient-to-br flex items-center justify-center',
                            g.color,
                          )}>
                            <Icon className="w-4 h-4 text-white" />
                          </div>
                          <span className="text-xs font-arabic font-semibold">{g.label}</span>
                          {on && <Check className="w-3 h-3 text-jood-teal-700" />}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-center text-muted-foreground font-arabic mt-3">
                    اختاري على الأقل هدفاً واحداً
                  </p>
                </motion.div>
              )}

              {/* ── Step 2: Prefs ─────────────────────────────────────────── */}
              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-5"
                >
                  <div className="text-center mb-2">
                    <h2 className="text-xl font-bold font-arabic mb-1">كيف نتواصل؟</h2>
                    <p className="text-xs text-muted-foreground font-arabic">
                      ضبط بسيط لتجربة مريحة — قابل للتعديل دائماً.
                    </p>
                  </div>

                  {/* Risk profile */}
                  <div>
                    <Label className="font-arabic text-xs mb-2 block">نمط الاستثمار المفضّل</Label>
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
                    <Label className="font-arabic text-xs mb-2 block">طريقة التواصل المفضّلة</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setForm(f => ({ ...f, voice_first: true }))}
                        className={cn(
                          'p-3 rounded-xl border-2 transition-all',
                          form.voice_first
                            ? 'border-jood-teal-700 bg-jood-teal-900/5'
                            : 'border-border/40',
                        )}
                      >
                        <div className="text-xl mb-1">🎙️</div>
                        <div className="text-xs font-arabic font-bold">صوتية أولاً</div>
                      </button>
                      <button
                        onClick={() => setForm(f => ({ ...f, voice_first: false }))}
                        className={cn(
                          'p-3 rounded-xl border-2 transition-all',
                          !form.voice_first
                            ? 'border-jood-teal-700 bg-jood-teal-900/5'
                            : 'border-border/40',
                        )}
                      >
                        <div className="text-xl mb-1">⌨️</div>
                        <div className="text-xs font-arabic font-bold">كتابية</div>
                      </button>
                    </div>
                  </div>

                  {/* Language */}
                  <div>
                    <Label className="font-arabic text-xs mb-2 block">اللغة</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setForm(f => ({ ...f, language: 'ar' }))}
                        className={cn(
                          'p-2.5 rounded-xl border-2 text-xs font-arabic transition-all',
                          form.language === 'ar' ? 'border-jood-teal-700 bg-jood-teal-900/5' : 'border-border/40',
                        )}
                      >
                        🇸🇦 عربية فقط
                      </button>
                      <button
                        onClick={() => setForm(f => ({ ...f, language: 'ar-en' }))}
                        className={cn(
                          'p-2.5 rounded-xl border-2 text-xs font-arabic transition-all',
                          form.language === 'ar-en' ? 'border-jood-teal-700 bg-jood-teal-900/5' : 'border-border/40',
                        )}
                      >
                        🌍 عربية + إنجليزية
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── Step 3: Avatar ────────────────────────────────────────── */}
              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="text-center mb-4">
                    <h2 className="text-xl font-bold font-arabic mb-1">اختاري لون جود</h2>
                    <p className="text-xs text-muted-foreground font-arabic">
                      الشخصية البصرية لمساعدتك — لكِ وحدك.
                    </p>
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
                        <div className={cn(
                          'w-10 h-10 rounded-full bg-gradient-to-br flex items-center justify-center',
                          a.gradient,
                        )}>
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
                    أهلاً يا {form.display_name.split(' ')[0]} 🌟
                  </h2>
                  <p className="text-sm text-muted-foreground font-arabic max-w-xs leading-relaxed">
                    جود جاهزة لمرافقتك. دعينا نبدأ رحلتك الذكية.
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
                <ChevronRight className="w-4 h-4" /> رجوع
              </Button>
              <Button
                onClick={next}
                disabled={!canAdvance() || saving}
                className="bg-gradient-to-r from-jood-teal-900 to-jood-teal-700 hover:from-jood-teal-700 hover:to-jood-teal-900 text-white font-arabic gap-1"
              >
                {step === 3 ? (saving ? 'جارٍ الحفظ…' : 'إنهاء') : 'التالي'}
                <ChevronLeft className="w-4 h-4" />
              </Button>
            </div>
          )}
        </Card>
      </motion.div>
    </div>
  );
};

export default Onboarding;
