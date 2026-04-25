import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { X, Mic, MicOff, Volume2, Sparkles, Pause, Play } from 'lucide-react';
import { useChat } from '@/hooks/useChat';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { JoodAvatar, type AvatarMode } from './JoodAvatar';

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

// ─── Spinner for whisper processing ──────────────────────────────────────────
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

// ─── Mode definitions ─────────────────────────────────────────────────────────
type Mode = 'idle' | 'listening' | 'processing' | 'thinking' | 'speaking';

const MODE_LABELS: Record<Mode, { ar: string; sub: string }> = {
  idle:       { ar: 'اضغطي للبدء',        sub: 'اضغطة قصيرة = مستمر · مطوّلة = push-to-talk' },
  listening:  { ar: 'أستمع إليك…',        sub: 'تحدثي بحرّية' },
  processing: { ar: 'جار التعرف…',        sub: 'Whisper يعالج صوتك' },
  thinking:   { ar: 'أفكّر…',             sub: 'لحظة من فضلك' },
  speaking:   { ar: 'جود تتحدث',          sub: 'اضغطي لمقاطعتها' },
};

// ─── Supported MIME type picker ───────────────────────────────────────────────
function getBestMimeType(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];
  return candidates.find(t => {
    try { return MediaRecorder.isTypeSupported(t); } catch { return false; }
  }) ?? '';
}

interface MajlisModeProps {
  onClose: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
export const MajlisMode: React.FC<MajlisModeProps> = ({ onClose }) => {
  const { session } = useAuth();
  const { toast } = useToast();
  const { sendMessage, speakMessage, messages, loading, speaking, speakingIntensity } = useChat();

  const [mode, setMode] = useState<Mode>('idle');
  const [transcript, setTranscript] = useState('');
  const [lastReply, setLastReply] = useState('');
  const [continuous, setContinuous] = useState(false);
  const [intensity, setIntensity] = useState(0);

  // ── Refs ─────────────────────────────────────────────────────────────────
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const mimeTypeRef = useRef<string>('audio/webm');
  const holdTimerRef = useRef<number | null>(null);
  const isHoldingRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  /** Prevents the mode-sync useEffect from overriding 'processing' state */
  const isProcessingRef = useRef(false);

  // ── Sync mode with chat state (when not processing Whisper) ──────────────
  useEffect(() => {
    if (isProcessingRef.current) return;
    if (loading) setMode('thinking');
    else if (speaking) setMode('speaking');
    else if (mode === 'thinking' || mode === 'speaking') setMode('idle');
  }, [loading, speaking]); // eslint-disable-line

  // ── Track latest assistant reply for display + replay ────────────────────
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last?.role === 'assistant') setLastReply(last.content);
  }, [messages]);

  // ── AnalyserNode tick ─────────────────────────────────────────────────────
  const startAnalyserLoop = useCallback((stream: MediaStream) => {
    try {
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
      // mic blocked — visualizer falls back to static animation
    }
  }, []);

  const stopAnalyser = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    audioCtxRef.current?.close().catch(() => {});
    streamRef.current?.getTracks().forEach(t => t.stop());
    audioCtxRef.current = null;
    analyserRef.current = null;
    streamRef.current = null;
    setIntensity(0);
  }, []);

  // ── Main recording flow ───────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (mediaRecorderRef.current) return; // already recording
    if (!session) {
      toast({ title: 'غير مسجّل دخول', variant: 'destructive' });
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch {
      toast({
        title: 'لا يمكن الوصول للميكروفون',
        description: 'يرجى السماح للتطبيق بالوصول للميكروفون في إعدادات المتصفح',
        variant: 'destructive',
      });
      return;
    }

    streamRef.current = stream;
    startAnalyserLoop(stream);

    const mimeType = getBestMimeType();
    mimeTypeRef.current = mimeType;
    chunksRef.current = [];

    const mr = new MediaRecorder(stream, mimeType ? { mimeType } : {});
    mediaRecorderRef.current = mr;

    mr.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    mr.onstop = async () => {
      // ── Tear down audio capture ─────────────────────────────────────────
      stopAnalyser();
      mediaRecorderRef.current = null;

      const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current || 'audio/webm' });
      chunksRef.current = [];

      // Ignore very short recordings (< 0.5 KB → silence or misfire)
      if (blob.size < 500) {
        isProcessingRef.current = false;
        setMode('idle');
        return;
      }

      // ── Phase 1: Whisper STT ────────────────────────────────────────────
      isProcessingRef.current = true;
      setMode('processing');
      setTranscript('جار التعرف على صوتك…');

      try {
        const ext = mimeTypeRef.current.includes('mp4')  ? 'mp4'
                  : mimeTypeRef.current.includes('ogg')  ? 'ogg'
                  : 'webm';

        const formData = new FormData();
        formData.append('audio', blob, `recording.${ext}`);

        const { data: sttData, error: sttErr } = await supabase.functions.invoke(
          'whisper-transcribe',
          {
            body: formData,
            headers: { Authorization: `Bearer ${session.access_token}` },
          },
        );

        if (sttErr || !sttData?.text?.trim()) {
          throw new Error(sttErr?.message ?? 'Empty transcript');
        }

        const text: string = sttData.text.trim();
        const lang: 'ar' | 'en' | 'mixed' = sttData.language ?? 'ar';

        setTranscript(text);

        // ── Phase 2: ai-chat ──────────────────────────────────────────────
        isProcessingRef.current = false; // let loading state take over mode

        const result = await sendMessage(text, {
          voice_mode: true,
          detected_language: lang,
        });

        setTranscript('');

        // ── Phase 3: ElevenLabs TTS ────────────────────────────────────────
        if (result?.message) {
          const emotion = result.suggested_emotion ?? 'neutral';
          await speakMessage(result.message, emotion, true);
        }

      } catch (err: any) {
        console.error('[MajlisMode] voice pipeline error:', err);
        isProcessingRef.current = false;
        setMode('idle');
        setTranscript('');
        toast({
          title: 'لم أستطع التعرف على صوتك',
          description: 'حاولي مجدداً أو تحدثي بشكل أوضح',
          variant: 'destructive',
        });
      }
    };

    mr.start(250); // collect chunks every 250 ms for responsive feedback
    setMode('listening');
  }, [session, sendMessage, speakMessage, startAnalyserLoop, stopAnalyser, toast]);

  const stopRecording = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (!mr || mr.state === 'inactive') return;
    try { mr.stop(); } catch { /* already stopped */ }
  }, []);

  // ── Press-and-hold interaction ────────────────────────────────────────────
  const handlePressDown = () => {
    isHoldingRef.current = true;
    // Wait 250 ms — if still held → push-to-talk; otherwise treat as tap
    holdTimerRef.current = window.setTimeout(() => {
      if (isHoldingRef.current && mode === 'idle') startRecording();
    }, 250);
  };

  const handlePressUp = () => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    if (!isHoldingRef.current) return;
    isHoldingRef.current = false;

    if (mode === 'listening') {
      // Push-to-talk release → send what we have
      stopRecording();
    } else if (mode === 'idle') {
      // Pure tap → toggle continuous mode
      setContinuous(true);
      startRecording();
    } else if (mode === 'speaking') {
      // Interrupt TTS — we don't have direct handle to <Audio>, but speaking
      // ends naturally; user can wait or we set speaking=false via hook
    }
  };

  // ── Continuous mode: auto-restart after assistant finishes speaking ────────
  useEffect(() => {
    if (
      continuous &&
      !speaking && !loading &&
      mode === 'idle' &&
      !mediaRecorderRef.current &&
      !isProcessingRef.current
    ) {
      const t = setTimeout(() => startRecording(), 600);
      return () => clearTimeout(t);
    }
  }, [continuous, speaking, loading, mode, startRecording]);

  // ── Toggle continuous via side button ─────────────────────────────────────
  const toggleContinuous = () => {
    if (continuous) {
      setContinuous(false);
      stopRecording();
    } else {
      setContinuous(true);
      if (mode === 'idle') startRecording();
    }
  };

  // ── Replay last response ──────────────────────────────────────────────────
  const replay = () => {
    if (lastReply && mode === 'idle') speakMessage(lastReply, 'neutral', false);
  };

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopRecording();
      stopAnalyser();
    };
  }, [stopRecording, stopAnalyser]);

  const labels = MODE_LABELS[mode];

  // ─── Render ───────────────────────────────────────────────────────────────
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

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between p-5">
        <div className="flex items-center gap-2 text-white">
          <Sparkles className="w-4 h-4 text-jood-gold-300" />
          <span className="font-arabic text-sm font-bold">المجلس</span>
          {continuous && (
            <span className="text-[10px] bg-jood-gold-500/30 text-jood-gold-100 border border-jood-gold-300/30 rounded-full px-2 py-0.5 font-arabic">
              مستمر
            </span>
          )}
          {/* Engine badge */}
          <span className="text-[10px] bg-white/10 text-white/50 rounded-full px-2 py-0.5">
            Whisper · ElevenLabs
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => { stopRecording(); onClose(); }}
          className="text-white hover:bg-white/10 rounded-full h-10 w-10"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* ── Center: Avatar + Visualizer ──────────────────────────────────── */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-6">

        {/* Pulse rings + live video avatar */}
        <div className="relative w-80 h-80 flex items-center justify-center">
          <PulseRings
            active={mode === 'listening' || mode === 'speaking'}
            intensity={intensity}
          />

          {/* ── Jood video avatar (lip-sync via state crossfade) ──────── */}
          {/* During speaking → use TTS amplitude. During listening → mic.   */}
          <JoodAvatar
            mode={(mode === 'processing' ? 'thinking' : mode) as AvatarMode}
            intensity={mode === 'speaking' ? speakingIntensity : intensity}
            size={280}
            className="relative z-10"
          />
        </div>

        {/* Frequency bars / thinking dots */}
        <div className="mt-6">
          {mode === 'processing' || mode === 'thinking'
            ? <ThinkingDots />
            : <FreqBars active={mode === 'listening' || mode === 'speaking'} />
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
            <p className="text-white text-2xl font-arabic font-bold">{labels.ar}</p>
            <p className="text-jood-gold-300/80 text-xs font-arabic mt-1">{labels.sub}</p>
          </motion.div>
        </AnimatePresence>

        {/* Live transcript (from Whisper) */}
        <AnimatePresence>
          {transcript && (
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

        {/* Last AI reply preview */}
        <AnimatePresence>
          {!transcript && lastReply && (mode === 'speaking' || mode === 'idle') && (
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
      <div className="absolute bottom-0 inset-x-0 z-10 p-6 flex items-center justify-center gap-4">

        {/* Replay last response */}
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

        {/* ── Big mic / status button ──────────────────────────────────── */}
        <button
          onMouseDown={handlePressDown}
          onMouseUp={handlePressUp}
          onMouseLeave={() => { if (isHoldingRef.current) handlePressUp(); }}
          onTouchStart={(e) => { e.preventDefault(); handlePressDown(); }}
          onTouchEnd={(e)   => { e.preventDefault(); handlePressUp(); }}
          disabled={mode === 'processing' || mode === 'thinking'}
          className={cn(
            'relative h-20 w-20 rounded-full flex items-center justify-center transition-all shadow-luxury',
            'select-none touch-none disabled:cursor-not-allowed disabled:opacity-50',
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
          onClick={toggleContinuous}
          disabled={mode === 'processing' || mode === 'thinking'}
          className={cn(
            'rounded-full h-12 w-12 flex-shrink-0 text-white hover:bg-white/10',
            continuous && 'bg-jood-gold-500/20 border border-jood-gold-300/40',
            'disabled:opacity-40',
          )}
          title={continuous ? 'إيقاف المستمر' : 'تشغيل المستمر'}
        >
          {continuous ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
        </Button>
      </div>

      {/* Bottom hint */}
      <p className="absolute bottom-2 inset-x-0 text-center text-[10px] text-white/40 font-arabic">
        اضغطة قصيرة = حديث مستمر · اضغطة مطوّلة = push-to-talk
      </p>
    </motion.div>
  );
};

export default MajlisMode;
