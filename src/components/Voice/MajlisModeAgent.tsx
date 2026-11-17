import React, { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { X, Mic, MicOff, Sparkles, Phone, PhoneOff, RotateCcw, MessageSquare, WifiOff, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { JoodOrb, type OrbMode } from './JoodOrb';
import { useLanguage } from '@/hooks/useLanguage';
import { useRoles } from '@/hooks/useRoles';
import { useGeminiLive } from '@/hooks/useGeminiLive';
import { useElevenLabsMajlis } from '@/hooks/useElevenLabsMajlis';
import type { CallIssue, EngineId, MajlisMode } from './majlisEngine';

const ENGINE_KEY = 'jood.majlis.engine';
const readEngine = (): EngineId => {
  try { return localStorage.getItem(ENGINE_KEY) === 'elevenlabs' ? 'elevenlabs' : 'gemini'; } catch { return 'gemini'; }
};

// ─── Audio-reactive visualizer rings ─────────────────────────────────────────
const PulseRings: React.FC<{ active: boolean; intensity: number }> = ({ active, intensity }) => (
  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
    {[0, 1, 2].map(i => (
      <motion.div
        key={i}
        className="absolute rounded-full border-2 border-jood-gold-500/30"
        animate={
          active
            ? {
                scale: [1, 1.4 + intensity * 0.4, 1.7 + intensity * 0.6],
                opacity: [0.7, 0.3, 0],
              }
            : { scale: 1, opacity: 0 }
        }
        transition={{
          duration: 2.4,
          repeat: Infinity,
          delay: i * 0.6,
          ease: 'easeOut',
        }}
        style={{ width: 280, height: 280 }}
      />
    ))}
  </div>
);

// ─── Frequency bars ───────────────────────────────────────────────────────────
const FreqBars: React.FC<{ active: boolean }> = ({ active }) => (
  <div className="flex items-center justify-center gap-1 h-12">
    {Array.from({ length: 9 }).map((_, i) => (
      <motion.span
        key={i}
        className="w-1 rounded-full bg-jood-gold-500"
        animate={active
          ? { height: ['8px', `${20 + Math.random() * 28}px`, '8px'] }
          : { height: '4px' }
        }
        transition={{
          duration: 0.8 + Math.random() * 0.4,
          repeat: active ? Infinity : 0,
          delay: i * 0.05,
          ease: 'easeInOut',
        }}
      />
    ))}
  </div>
);

// ─── Thinking dots ──────────────────────────────────────────────────────────
const ThinkingDots: React.FC = () => (
  <div className="flex gap-1.5 items-center justify-center">
    {[0, 1, 2].map(i => (
      <motion.span
        key={i}
        className="w-2 h-2 rounded-full bg-jood-gold-400"
        animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
        transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.2 }}
      />
    ))}
  </div>
);

type Mode = MajlisMode;

interface MajlisModeAgentProps {
  onClose: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Majlis — Jood's live voice call.
//
// Two engines share one screen:
//   • gemini      Gemini Live native audio (default, low cost per minute)
//   • elevenlabs  ElevenLabs Conversational AI (premium voice, admins only for now)
// Both report call time to voice_usage so monthly minutes can be capped.
// ═══════════════════════════════════════════════════════════════════════════════

export const MajlisModeAgent: React.FC<MajlisModeAgentProps> = ({ onClose }) => {
  const { t, tg, lang, dir, gender } = useLanguage();
  const { isAdmin } = useRoles();
  const canChooseEngine = isAdmin();

  const [engineId, setEngineId] = useState<EngineId>(readEngine);
  const gemini = useGeminiLive();
  const eleven = useElevenLabsMajlis();
  const activeEngineId: EngineId = canChooseEngine ? engineId : 'gemini';
  const engine = activeEngineId === 'elevenlabs' ? eleven : gemini;
  const { mode, transcript, lastReply, isMuted, intensity, connected, issue, secondsLeft } = engine;

  const chooseEngine = useCallback((id: EngineId) => {
    if (connected || mode === 'connecting') return;
    setEngineId(id);
    try { localStorage.setItem(ENGINE_KEY, id); } catch { /* private mode */ }
  }, [connected, mode]);

  const MODE_LABELS: Record<Mode, { label: string; sub: string }> = {
    idle:       { label: tg('majlis.idle'),       sub: lang === 'ar' ? (gender === 'female' ? 'اضغطي الاتصال للبدء' : 'اضغط الاتصال للبدء') : 'Press call to start' },
    connecting: { label: lang === 'ar' ? 'جاري الاتصال…' : 'Connecting…', sub: lang === 'ar' ? 'تحضير جود…' : 'Preparing Jood…' },
    listening:  { label: t('majlis.listening'),   sub: tg('majlis.listening.sub') },
    thinking:   { label: t('majlis.thinking'),    sub: t('majlis.thinking.sub') },
    speaking:   { label: t('majlis.speaking'),    sub: tg('majlis.speaking.sub') },
  };

  const startConversation = engine.start;
  const endConversation = engine.end;
  const toggleMute = engine.toggleMute;

  const continueByText = useCallback(() => {
    void endConversation();
    window.dispatchEvent(new CustomEvent('jood:navigate', { detail: { tab: 'chat' } }));
    onClose();
  }, [endConversation, onClose]);

  const ar = lang === 'ar';
  const g = (male: string, female: string) => (gender === 'female' ? female : male);
  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);

  const ISSUE_COPY: Record<CallIssue, { title: string; body: string; note?: string }> = {
    denied: {
      title: ar ? 'الميكروفون غير مسموح' : 'Microphone access is off',
      body: isIOS
        ? (ar ? g('من شريط العنوان اضغط «aA» ← إعدادات الموقع ← الميكروفون ← سماح، ثم أعد المحاولة.', 'من شريط العنوان اضغطي «aA» ← إعدادات الموقع ← الميكروفون ← سماح، ثم أعيدي المحاولة.')
              : 'Tap “aA” in the address bar → Website Settings → Microphone → Allow, then try again.')
        : (ar ? g('اضغط رمز القفل بجانب عنوان الموقع ← الميكروفون ← سماح، ثم أعد المحاولة.', 'اضغطي رمز القفل بجانب عنوان الموقع ← الميكروفون ← سماح، ثم أعيدي المحاولة.')
              : 'Click the lock icon next to the site address → Microphone → Allow, then try again.'),
      note: ar ? g('إذا فتحت جود داخل تطبيق آخر، افتحه في Safari أو Chrome.', 'إذا فتحتِ جود داخل تطبيق آخر، افتحيه في Safari أو Chrome.') : 'If JOOD is open inside another app, open it in Safari or Chrome.',
    },
    'no-device': {
      title: ar ? 'لم نجد ميكروفوناً' : 'No microphone found',
      body: ar ? g('وصّل ميكروفوناً أو سماعة، ثم أعد المحاولة.', 'وصّلي ميكروفوناً أو سماعة، ثم أعيدي المحاولة.') : 'Connect a microphone or headset, then try again.',
    },
    busy: {
      title: ar ? 'الميكروفون مشغول' : 'The microphone is in use',
      body: ar ? g('أغلق التطبيقات أو الصفحات التي تستخدم الميكروفون، ثم أعد المحاولة.', 'أغلقي التطبيقات أو الصفحات التي تستخدم الميكروفون، ثم أعيدي المحاولة.') : 'Close other apps or tabs using the microphone, then try again.',
    },
    unsupported: {
      title: ar ? 'هذا المتصفح لا يدعم المحادثة الصوتية' : "This browser can't use voice",
      body: ar ? g('افتح جود في أحدث إصدار من Safari أو Chrome للتحدث معها.', 'افتحي جود في أحدث إصدار من Safari أو Chrome للتحدث معها.') : 'Open JOOD in the latest Safari or Chrome to talk with Jood.',
    },
    insecure: {
      title: ar ? 'الصوت يحتاج اتصالاً آمناً' : 'Voice needs a secure connection',
      body: ar ? g('افتح جود من رابطه الآمن (https) لاستخدام الميكروفون.', 'افتحي جود من رابطه الآمن (https) لاستخدام الميكروفون.') : 'Open JOOD from its https:// address to use the microphone.',
    },
    minutes: {
      title: ar ? 'انتهت دقائق الصوت لهذا الشهر' : "You've used this month's voice minutes",
      body: ar ? g('تقدر تكمل مع جود بالكتابة، وتتجدد الدقائق بداية الشهر.', 'تقدرين تكملين مع جود بالكتابة، وتتجدد الدقائق بداية الشهر.') : 'You can keep going with Jood by text. Minutes renew at the start of next month.',
    },
    'not-configured': {
      title: ar ? 'المحادثة الصوتية غير متاحة حالياً' : 'Voice calls are not available yet',
      body: ar ? g('نجهّز صوت جود الآن. جرّب الكتابة لها في الوقت الحالي.', 'نجهّز صوت جود الآن. جرّبي الكتابة لها في الوقت الحالي.') : "We're getting Jood's voice ready. Try chatting by text for now.",
    },
    connection: {
      title: ar ? 'تعذّر الاتصال بجود' : "Couldn't reach Jood",
      body: ar ? g('تحقق من اتصالك بالإنترنت، ثم أعد المحاولة.', 'تحققي من اتصالك بالإنترنت، ثم أعيدي المحاولة.') : 'Check your internet connection, then try again.',
    },
  };

  const canRetry = issue !== 'minutes' && issue !== 'not-configured';
  const minutesLeft = secondsLeft == null ? null : Math.ceil(secondsLeft / 60);

  const labels = MODE_LABELS[mode];
  const isActive = mode === 'listening' || mode === 'speaking';

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="dark fixed inset-0 z-50 bg-gradient-to-br from-jood-teal-900 via-jood-teal-700 to-jood-teal-900 overflow-hidden"
      dir={dir}
    >
      {/* Ambient particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 30 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-jood-gold-300/40"
            initial={{
              x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1200),
              y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800),
              opacity: 0,
            }}
            animate={{ y: [null, -50], opacity: [0, 0.7, 0] }}
            transition={{
              duration: 5 + Math.random() * 3,
              repeat: Infinity,
              delay: Math.random() * 5,
            }}
          />
        ))}
      </div>

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between p-5">
        <div className="flex items-center gap-2 text-white">
          <Sparkles className="w-4 h-4 text-jood-gold-300" />
          <span className="font-arabic text-sm font-bold">{t('header.majlis')}</span>
          {connected && (
            <span className="text-[10px] bg-jood-gold-500/20 text-jood-gold-300 border border-jood-gold-300/30 rounded-full px-2.5 py-0.5 font-arabic">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-jood-gold-300 animate-pulse ltr:mr-1.5 rtl:ml-1.5 align-middle" />
              {lang === 'ar' ? 'متصلة' : 'Live'}
            </span>
          )}
          {minutesLeft != null && activeEngineId === 'gemini' && (connected || minutesLeft <= 15) && (
            <span
              className={cn(
                'inline-flex items-center gap-1 text-[10px] rounded-full px-2.5 py-0.5 font-arabic border',
                minutesLeft <= 5 ? 'bg-red-500/15 text-red-200 border-red-300/30' : 'bg-white/10 text-white/80 border-white/15',
              )}
              aria-label={ar ? `باقي ${minutesLeft} دقيقة هذا الشهر` : `${minutesLeft} voice minutes left this month`}
            >
              <Clock className="w-3 h-3" />
              <bdi dir="ltr">{minutesLeft}</bdi> {ar ? 'دقيقة' : 'min'}
            </span>
          )}
        </div>

        {canChooseEngine && (
          <div
            role="radiogroup"
            aria-label={ar ? 'محرك الصوت' : 'Voice engine'}
            className="absolute start-1/2 top-5 -translate-x-1/2 rtl:translate-x-1/2 hidden sm:flex glass rounded-full p-1 text-[11px] font-arabic"
          >
            {(['gemini', 'elevenlabs'] as const).map(id => (
              <button
                key={id}
                role="radio"
                aria-checked={activeEngineId === id}
                disabled={connected || mode === 'connecting'}
                onClick={() => chooseEngine(id)}
                className={cn(
                  'px-3 py-1 rounded-full transition-colors disabled:cursor-not-allowed',
                  activeEngineId === id ? 'bg-jood-gold-500 text-jood-teal-900 font-bold' : 'text-white/75 hover:text-white disabled:opacity-50',
                )}
              >
                {id === 'gemini' ? (ar ? 'جود لايف' : 'Jood Live') : (ar ? 'الصوت المميز' : 'Premium voice')}
              </button>
            ))}
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => { void endConversation(); onClose(); }}
          aria-label={ar ? 'إغلاق المجلس' : 'Close Majlis'}
          className="text-white hover:bg-white/10 rounded-full h-10 w-10"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* ── Center: Avatar + Visualizer ──────────────────────────────────── */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-6">

        {/* Pulse rings + the Jood Orb — النواة */}
        <div className={cn('relative flex items-center justify-center transition-all duration-300', issue ? 'w-48 h-48' : 'w-80 h-80')}>
          {!issue && <PulseRings active={isActive} intensity={intensity} />}
          <JoodOrb
            mode={mode as OrbMode}
            intensity={intensity}
            size={issue ? 160 : 260}
            withRings={!issue}
            className="relative z-10"
          />
        </div>

        {!issue && (
          <>
            {/* Frequency bars / thinking dots */}
            <div className="mt-6">
              {mode === 'connecting' || mode === 'thinking'
                ? <ThinkingDots />
                : <FreqBars active={isActive} />
              }
            </div>

            {/* Status label */}
            <AnimatePresence mode="wait">
              <motion.div
                key={mode}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="text-center mt-4"
              >
                <p className="text-white text-2xl font-arabic font-bold">{labels.label}</p>
                <p className="text-jood-gold-300/80 text-xs font-arabic mt-1">{labels.sub}</p>
              </motion.div>
            </AnimatePresence>
          </>
        )}

        {/* Microphone / connection problem — calm, actionable, never raw error text */}
        <AnimatePresence>
          {issue && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="mt-6 max-w-md w-full"
            >
              <div role="alert" className="glass rounded-2xl p-5 text-start">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-jood-gold-500/15 flex items-center justify-center flex-shrink-0">
                    {issue === 'minutes'
                      ? <Clock className="w-5 h-5 text-jood-gold-300" />
                      : issue === 'connection' || issue === 'not-configured'
                      ? <WifiOff className="w-5 h-5 text-jood-gold-300" />
                      : <MicOff className="w-5 h-5 text-jood-gold-300" />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-arabic font-bold text-foreground">{ISSUE_COPY[issue].title}</p>
                    <p className="font-arabic text-sm text-muted-foreground mt-1 leading-relaxed">{ISSUE_COPY[issue].body}</p>
                    {ISSUE_COPY[issue].note && (
                      <p className="font-arabic text-xs text-muted-foreground/80 mt-2">{ISSUE_COPY[issue].note}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  {canRetry && (
                    <button onClick={startConversation} className="jood-btn-primary flex-1 !px-3 !py-2.5 whitespace-nowrap font-arabic">
                      <RotateCcw className="w-4 h-4" />
                      {ar ? g('أعد المحاولة', 'أعيدي المحاولة') : 'Try again'}
                    </button>
                  )}
                  <button onClick={continueByText} className={cn(canRetry ? 'jood-btn-outline' : 'jood-btn-primary', 'flex-1 !px-3 !py-2.5 whitespace-nowrap font-arabic')}>
                    <MessageSquare className="w-4 h-4" />
                    {ar ? g('أكمل بالكتابة', 'أكملي بالكتابة') : 'Continue by text'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Live transcript */}
        <AnimatePresence>
          {!issue && transcript && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-6 max-w-md w-full"
            >
              <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl px-4 py-3">
                <p className="text-white/90 text-sm font-arabic text-center leading-relaxed">
                  {transcript}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Last AI reply */}
        <AnimatePresence>
          {!issue && !transcript && lastReply && (mode === 'speaking' || mode === 'listening' || mode === 'idle') && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-6 max-w-lg w-full"
            >
              <div className="bg-jood-gold-500/15 backdrop-blur-sm border border-jood-gold-300/30 rounded-2xl px-4 py-3">
                <p className="text-white text-xs font-arabic text-center leading-relaxed line-clamp-3">
                  {lastReply}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Bottom controls ───────────────────────────────────────────────── */}
      {/* While a problem card is open, its own buttons replace the call controls. */}
      <div className={cn('absolute bottom-0 inset-x-0 z-10 p-6 flex items-center justify-center gap-4', issue && 'hidden')}>

        {/* Mute toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleMute}
          disabled={!connected}
          aria-pressed={isMuted}
          aria-label={isMuted
            ? (ar ? 'تشغيل الميكروفون' : 'Unmute microphone')
            : (ar ? 'كتم الميكروفون' : 'Mute microphone')}
          className={cn(
            'rounded-full h-12 w-12 flex-shrink-0 text-white hover:bg-white/10 disabled:opacity-30',
            isMuted && 'bg-red-500/20 border border-red-300/40',
          )}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </Button>

        {/* ── Main call button ──────────────────────────────────────────── */}
        <button
          onClick={() => { void (connected ? endConversation() : startConversation()); }}
          aria-label={connected ? (ar ? 'إنهاء المكالمة' : 'End call') : (ar ? 'بدء المكالمة' : 'Start call')}
          disabled={mode === 'connecting'}
          className={cn(
            'relative h-20 w-20 rounded-full flex items-center justify-center transition-all shadow-luxury',
            'select-none touch-none disabled:cursor-not-allowed disabled:opacity-50',
            connected
              ? 'bg-destructive hover:bg-red-700 scale-110'
              : 'bg-gradient-to-br from-jood-gold-500 to-amber-700 hover:scale-105',
          )}
        >
          {connected
            ? <PhoneOff className="w-8 h-8 text-white" />
            : <Phone className="w-8 h-8 text-white" />
          }
          {connected && (
            <motion.span
              className="absolute inset-0 rounded-full border-4 border-destructive"
              animate={{ scale: [1, 1.2], opacity: [0.6, 0] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
          )}
        </button>

        {/* Spacer for symmetry */}
        <div className="w-12 h-12 flex-shrink-0" />
      </div>

      {/* Bottom hint */}
      <p className={cn('absolute bottom-2 inset-x-0 text-center text-[10px] text-white/40 font-arabic', issue && 'hidden')}>
        {connected
          ? (lang === 'ar' ? 'تحدث بشكل طبيعي — جود تسمعك وتجاوبك فوراً' : 'Speak naturally — Jood hears you and responds instantly')
          : (lang === 'ar' ? (gender === 'female' ? 'اضغطي زر الاتصال لبدء المحادثة مع جود' : 'اضغط زر الاتصال لبدء المحادثة مع جود') : 'Press the call button to start talking to Jood')
        }
      </p>
    </motion.div>
  );
};

export default MajlisModeAgent;
