import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { X, Mic, MicOff, Volume2, Sparkles, Pause, Play } from 'lucide-react';
import { useChat } from '@/hooks/useChat';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// ─── Visualizer ring (audio-reactive ripples) ─────────────────────────────────
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

// ─── Frequency bars (animated even without analyser) ──────────────────────────
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

// ─── Mode types ───────────────────────────────────────────────────────────────
type Mode = 'idle' | 'listening' | 'thinking' | 'speaking';

const MODE_LABELS: Record<Mode, { ar: string; sub: string }> = {
  idle:      { ar: 'اضغطي للبدء',      sub: 'أو اضغطي مطوّلاً للحديث المستمر' },
  listening: { ar: 'أستمع إليك…',     sub: 'تحدثي بحرّية' },
  thinking:  { ar: 'أفكّر…',           sub: 'لحظة من فضلك' },
  speaking:  { ar: 'جود تتحدث',       sub: 'اضغطي لمقاطعتها' },
};

interface MajlisModeProps {
  onClose: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
export const MajlisMode: React.FC<MajlisModeProps> = ({ onClose }) => {
  const { toast } = useToast();
  const { sendMessage, speakMessage, messages, loading, speaking } = useChat();

  const [mode, setMode] = useState<Mode>('idle');
  const [transcript, setTranscript] = useState('');
  const [lastReply, setLastReply] = useState('');
  const [continuous, setContinuous] = useState(false);
  const [intensity, setIntensity] = useState(0);

  const recognitionRef = useRef<any>(null);
  const holdTimerRef = useRef<number | null>(null);
  const isHoldingRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // ── Sync mode with chat state ───────────────────────────────────────────────
  useEffect(() => {
    if (loading) setMode('thinking');
    else if (speaking) setMode('speaking');
    else if (mode === 'thinking' || mode === 'speaking') setMode('idle');
  }, [loading, speaking]); // eslint-disable-line

  // ── Track latest assistant reply for display ────────────────────────────────
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last?.role === 'assistant') setLastReply(last.content);
  }, [messages]);

  // ── Audio analyser for visualizer intensity ────────────────────────────────
  const startAnalyser = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      const buf = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(buf);
        const avg = buf.reduce((s, v) => s + v, 0) / buf.length / 255;
        setIntensity(avg);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // mic blocked — just animate with random intensity
    }
  }, []);

  const stopAnalyser = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    audioCtxRef.current?.close().catch(() => {});
    streamRef.current?.getTracks().forEach(t => t.stop());
    audioCtxRef.current = null;
    streamRef.current = null;
    setIntensity(0);
  }, []);

  // ── SpeechRecognition lifecycle ─────────────────────────────────────────────
  const startListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast({ title: 'غير مدعوم', description: 'استخدمي Chrome أو Edge', variant: 'destructive' });
      return;
    }
    if (recognitionRef.current) return;

    const r = new SR();
    r.lang = 'ar-SA';
    r.continuous = continuous;
    r.interimResults = true;

    r.onstart = () => { setMode('listening'); startAnalyser(); };
    r.onend = () => {
      stopAnalyser();
      recognitionRef.current = null;
      // If we stopped while still in listening mode and not continuous, go idle
      setMode(m => (m === 'listening' ? 'idle' : m));
    };
    r.onerror = () => {
      stopAnalyser();
      recognitionRef.current = null;
      setMode('idle');
    };
    r.onresult = (e: any) => {
      let interim = '';
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const txt = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += txt;
        else interim += txt;
      }
      setTranscript((final || interim).trim());

      if (final.trim()) {
        const text = final.trim();
        setMode('thinking');
        // Stop recognizer before sending so we don't capture our own TTS
        try { r.stop(); } catch {}
        sendMessage(text).then(() => setTranscript(''));
      }
    };

    try {
      r.start();
      recognitionRef.current = r;
    } catch {
      recognitionRef.current = null;
    }
  }, [continuous, sendMessage, startAnalyser, stopAnalyser, toast]);

  const stopListening = useCallback(() => {
    try { recognitionRef.current?.stop(); } catch {}
    recognitionRef.current = null;
    stopAnalyser();
  }, [stopAnalyser]);

  // ── Press-and-hold handlers ─────────────────────────────────────────────────
  const handlePressDown = () => {
    isHoldingRef.current = true;
    // Tap = toggle continuous; Hold (>250ms) = push-to-talk
    holdTimerRef.current = window.setTimeout(() => {
      if (isHoldingRef.current) startListening();
    }, 250);
  };

  const handlePressUp = () => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    if (!isHoldingRef.current) return;
    const wasHolding = isHoldingRef.current;
    isHoldingRef.current = false;

    // If we started listening on hold, stop on release (push-to-talk)
    if (mode === 'listening' && !continuous) {
      stopListening();
    } else if (mode === 'idle' && wasHolding) {
      // Pure tap → toggle continuous mode
      setContinuous(true);
      startListening();
    } else if (mode === 'listening' && continuous) {
      stopListening();
      setContinuous(false);
    }
  };

  // ── Auto-restart in continuous mode after assistant finishes ────────────────
  useEffect(() => {
    if (continuous && !speaking && !loading && mode === 'idle' && !recognitionRef.current) {
      const t = setTimeout(() => startListening(), 500);
      return () => clearTimeout(t);
    }
  }, [continuous, speaking, loading, mode, startListening]);

  // ── Replay last reply ───────────────────────────────────────────────────────
  const replay = () => {
    if (lastReply) speakMessage(lastReply);
  };

  // ── Cleanup on unmount ──────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopListening();
      stopAnalyser();
    };
  }, [stopListening, stopAnalyser]);

  const labels = MODE_LABELS[mode];

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="fixed inset-0 z-50 bg-gradient-to-br from-jood-teal-900 via-jood-teal-700 to-jood-teal-900 overflow-hidden"
      dir="rtl"
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

      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between p-5">
        <div className="flex items-center gap-2 text-white">
          <Sparkles className="w-4 h-4 text-jood-gold-300" />
          <span className="font-arabic text-sm font-bold">المجلس</span>
          {continuous && (
            <span className="text-[10px] bg-jood-gold-500/30 text-jood-gold-100 border border-jood-gold-300/30 rounded-full px-2 py-0.5 font-arabic">
              مستمر
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => { stopListening(); onClose(); }}
          className="text-white hover:bg-white/10 rounded-full h-10 w-10"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* ── Center: Avatar + Visualizer ────────────────────────────────────── */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-6">

        {/* Pulse rings */}
        <div className="relative w-72 h-72 flex items-center justify-center">
          <PulseRings active={mode === 'listening' || mode === 'speaking'} intensity={intensity} />

          {/* Avatar orb */}
          <motion.div
            animate={{
              scale: mode === 'speaking' ? [1, 1.06, 1] :
                     mode === 'thinking' ? [1, 0.96, 1] :
                     mode === 'listening' ? 1 + intensity * 0.15 : 1,
            }}
            transition={{
              duration: mode === 'speaking' ? 1.2 :
                        mode === 'thinking' ? 1.6 : 0.2,
              repeat: (mode === 'speaking' || mode === 'thinking') ? Infinity : 0,
              ease: 'easeInOut',
            }}
            className={cn(
              'w-44 h-44 rounded-full flex items-center justify-center shadow-luxury',
              'bg-gradient-to-br from-jood-gold-300 via-jood-gold-500 to-jood-gold-700',
              'relative z-10',
            )}
          >
            <div className="w-40 h-40 rounded-full bg-gradient-to-br from-jood-teal-700 to-jood-teal-900 flex items-center justify-center">
              <span className="text-7xl font-display text-jood-gold-300 select-none">ج</span>
            </div>
          </motion.div>
        </div>

        {/* Frequency bars */}
        <div className="mt-6">
          <FreqBars active={mode === 'listening' || mode === 'speaking'} />
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
            <p className="text-white text-2xl font-arabic font-bold">{labels.ar}</p>
            <p className="text-jood-gold-300/80 text-xs font-arabic mt-1">{labels.sub}</p>
          </motion.div>
        </AnimatePresence>

        {/* Live transcript */}
        <AnimatePresence>
          {transcript && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-6 max-w-md"
            >
              <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl px-4 py-3">
                <p className="text-white/90 text-sm font-arabic text-center leading-relaxed">
                  {transcript}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Last reply preview */}
        <AnimatePresence>
          {!transcript && lastReply && (mode === 'speaking' || mode === 'idle') && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-6 max-w-lg"
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

      {/* ── Bottom controls ────────────────────────────────────────────────── */}
      <div className="absolute bottom-0 inset-x-0 z-10 p-6 flex items-center justify-center gap-4">

        {/* Replay last */}
        <Button
          variant="ghost"
          size="icon"
          onClick={replay}
          disabled={!lastReply || mode !== 'idle'}
          className="text-white hover:bg-white/10 rounded-full h-12 w-12 flex-shrink-0 disabled:opacity-30"
          title="إعادة الاستماع"
        >
          <Volume2 className="w-5 h-5" />
        </Button>

        {/* Big mic button (press-and-hold OR tap-to-toggle) */}
        <button
          onMouseDown={handlePressDown}
          onMouseUp={handlePressUp}
          onMouseLeave={() => isHoldingRef.current && handlePressUp()}
          onTouchStart={(e) => { e.preventDefault(); handlePressDown(); }}
          onTouchEnd={(e) => { e.preventDefault(); handlePressUp(); }}
          className={cn(
            'relative h-20 w-20 rounded-full flex items-center justify-center transition-all shadow-luxury',
            'select-none touch-none',
            mode === 'listening'
              ? 'bg-destructive scale-110'
              : 'bg-gradient-to-br from-jood-gold-500 to-amber-700 hover:scale-105',
          )}
        >
          {mode === 'listening'
            ? <MicOff className="w-8 h-8 text-white" />
            : <Mic className="w-8 h-8 text-white" />
          }
          {mode === 'listening' && (
            <motion.span
              className="absolute inset-0 rounded-full border-4 border-destructive"
              animate={{ scale: [1, 1.2], opacity: [0.6, 0] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
          )}
        </button>

        {/* Toggle continuous */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            if (continuous) { setContinuous(false); stopListening(); }
            else { setContinuous(true); startListening(); }
          }}
          className={cn(
            'rounded-full h-12 w-12 flex-shrink-0 text-white hover:bg-white/10',
            continuous && 'bg-jood-gold-500/20 border border-jood-gold-300/40',
          )}
          title={continuous ? 'إيقاف المستمر' : 'تشغيل المستمر'}
        >
          {continuous ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
        </Button>
      </div>

      {/* Hint text */}
      <p className="absolute bottom-2 inset-x-0 text-center text-[10px] text-white/40 font-arabic">
        اضغطة قصيرة = حديث مستمر · اضغطة مطوّلة = push-to-talk
      </p>
    </motion.div>
  );
};

export default MajlisMode;
