import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Volume2, Sparkles, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useChat } from '@/hooks/useChat';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/useLanguage';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { JoodOrb } from './JoodOrb';

// ─── Mode types ───────────────────────────────────────────────────────────────
type VoiceMode = 'idle' | 'listening' | 'processing' | 'thinking' | 'speaking';

const MODE_CONFIG: Record<VoiceMode, { ar: string; en: string; color: string }> = {
  idle:       { ar: 'اضغطي للتحدث مع جود',  en: 'Tap to talk to Jood',        color: 'from-jood-teal-700 to-jood-teal-900' },
  listening:  { ar: 'أستمع إليك…',          en: 'Listening…',                 color: 'from-red-600 to-red-800' },
  processing: { ar: 'جار التعرف على صوتك…', en: 'Recognizing your voice…',    color: 'from-amber-600 to-amber-800' },
  thinking:   { ar: 'جود تفكّر…',           en: 'Jood is thinking…',          color: 'from-jood-teal-600 to-jood-teal-800' },
  speaking:   { ar: 'جود تتحدث',            en: 'Jood is speaking',           color: 'from-jood-gold-500 to-amber-700' },
};

// ─── Waveform bars ────────────────────────────────────────────────────────────
const WaveformBars: React.FC<{ active: boolean }> = ({ active }) => (
  <div className="flex items-center justify-center gap-1 h-10">
    {Array.from({ length: 11 }).map((_, i) => (
      <motion.span
        key={i}
        className="w-1 rounded-full bg-jood-gold-500/80"
        animate={active
          ? { height: ['4px', `${14 + Math.sin(i * 0.7) * 12}px`, '4px'] }
          : { height: '4px' }
        }
        transition={{
          duration: 0.7 + i * 0.06,
          repeat: active ? Infinity : 0,
          delay: i * 0.05,
          ease: 'easeInOut',
        }}
      />
    ))}
  </div>
);

// ─── Typing dots ──────────────────────────────────────────────────────────────
const ThinkingDots: React.FC = () => (
  <div className="flex gap-1.5 items-center justify-center h-10">
    {[0, 1, 2].map(i => (
      <motion.span
        key={i}
        className="w-2 h-2 rounded-full bg-jood-teal-400"
        animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
        transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.18 }}
      />
    ))}
  </div>
);

function getBestMimeType(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  return candidates.find(t => { try { return MediaRecorder.isTypeSupported(t); } catch { return false; } }) ?? '';
}

// ═══════════════════════════════════════════════════════════════════════════════
export const VoicePanel: React.FC = () => {
  const { session } = useAuth();
  const { toast } = useToast();
  const { lang, gender } = useLanguage();
  const { sendMessage, speakMessage, stopSpeaking, messages, loading, speaking, speakingIntensity } = useChat();

  const [mode, setMode] = useState<VoiceMode>('idle');
  const [transcript, setTranscript] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef        = useRef<BlobPart[]>([]);
  const mimeTypeRef      = useRef<string>('audio/webm');
  const streamRef        = useRef<MediaStream | null>(null);
  const isProcessingRef  = useRef(false);
  // VAD refs
  const vadCtxRef            = useRef<AudioContext | null>(null);
  const vadRafRef            = useRef<number | null>(null);
  const vadSilenceStartRef   = useRef<number | null>(null);
  const vadSpeechDetectedRef = useRef(false);
  const vadRecStartRef       = useRef(0);
  const VAD_SILENCE_THRESHOLD = 0.028;
  const VAD_SILENCE_MS        = 500;   // was 700ms — 200ms faster response
  const VAD_SPEECH_MIN_MS     = 400;   // was 500ms — quicker pickup

  // Sync mode with chat state
  useEffect(() => {
    if (isProcessingRef.current) return;
    if (loading) setMode('thinking');
    else if (speaking) setMode('speaking');
    else if (mode === 'thinking' || mode === 'speaking') setMode('idle');
  }, [loading, speaking]); // eslint-disable-line

  const lastMessages = messages.slice(-4);

  const startRecording = useCallback(async () => {
    if (mediaRecorderRef.current || !session) return;

    let stream: MediaStream;
    try {
      // Audio constraints tuned for Whisper / gpt-4o-transcribe:
      // - echoCancellation: removes microphone echo from speaker output
      // - noiseSuppression: reduces background noise (office, AC, etc.)
      // - sampleRate: 16000 is Whisper's native rate — avoids resampling artefacts
      // - channelCount: 1 mono — half the data, identical quality for speech
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl:  true,
          sampleRate:       16000,
          channelCount:     1,
        },
        video: false,
      });
    } catch {
      // Browser may reject sampleRate constraint — try without it
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: false,
        });
      } catch {
        toast({
          title: lang === 'ar' ? 'لا يمكن الوصول للميكروفون' : 'Microphone access denied',
          description: lang === 'ar' ? 'يرجى السماح بالوصول للميكروفون في إعدادات المتصفح' : 'Please allow microphone access in your browser settings',
          variant: 'destructive',
        });
        return;
      }
    }

    streamRef.current = stream;
    chunksRef.current = [];
    const mimeType = getBestMimeType();
    mimeTypeRef.current = mimeType;

    // ── VAD: silence detection for auto-stop ─────────────────────────────
    vadSilenceStartRef.current   = null;
    vadSpeechDetectedRef.current = false;
    vadRecStartRef.current       = Date.now();
    try {
      const vadCtx = new AudioContext();
      vadCtxRef.current = vadCtx;
      const src      = vadCtx.createMediaStreamSource(stream);
      const analyser = vadCtx.createAnalyser();
      analyser.fftSize = 64;
      src.connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);

      const vadTick = () => {
        analyser.getByteFrequencyData(buf);
        const avg     = buf.reduce((s, v) => s + v, 0) / buf.length / 255;
        const now     = Date.now();
        const elapsed = now - vadRecStartRef.current;

        if (elapsed > VAD_SPEECH_MIN_MS) {
          if (avg > VAD_SILENCE_THRESHOLD) {
            vadSpeechDetectedRef.current = true;
            vadSilenceStartRef.current   = null;
          } else if (vadSpeechDetectedRef.current) {
            if (!vadSilenceStartRef.current) { vadSilenceStartRef.current = now; }
            else if (now - vadSilenceStartRef.current >= VAD_SILENCE_MS) {
              stopRecording();
              return;
            }
          }
        }
        vadRafRef.current = requestAnimationFrame(vadTick);
      };
      vadTick();
    } catch { /* VAD unavailable — manual stop only */ }

    const mr = new MediaRecorder(stream, mimeType ? { mimeType } : {});
    mediaRecorderRef.current = mr;

    mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };

    mr.onstop = async () => {
      // Teardown VAD
      if (vadRafRef.current) { cancelAnimationFrame(vadRafRef.current); vadRafRef.current = null; }
      vadCtxRef.current?.close().catch(() => {});
      vadCtxRef.current = null;

      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      mediaRecorderRef.current = null;

      const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current || 'audio/webm' });
      chunksRef.current = [];

      if (blob.size < 500) { isProcessingRef.current = false; setMode('idle'); return; }

      isProcessingRef.current = true;
      setMode('processing');
      setTranscript(MODE_CONFIG.processing[lang === 'ar' ? 'ar' : 'en']);

      // Direct fetch — bypasses supabase.functions.invoke wrapper (~200ms saved)
      const supabaseUrl = 'https://neadnclykbukvmlquepg.supabase.co';
      const anonKey     = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const authHeaders = {
        'Authorization': `Bearer ${session.access_token}`,
        ...(anonKey ? { 'apikey': anonKey } : {}),
      };

      try {
        // ── STT (direct fetch) ───────────────────────────────────────────
        const ext = mimeTypeRef.current.includes('mp4') ? 'mp4'
                  : mimeTypeRef.current.includes('ogg') ? 'ogg' : 'webm';
        const formData = new FormData();
        formData.append('audio', blob, `recording.${ext}`);

        const sttRes = await fetch(`${supabaseUrl}/functions/v1/whisper-transcribe`, {
          method: 'POST',
          headers: { ...authHeaders, 'x-stt-model': 'gpt-4o-mini-transcribe' },
          body: formData,
        });
        if (!sttRes.ok) throw new Error(`STT ${sttRes.status}`);
        const sttData = await sttRes.json();
        const text: string = sttData?.text?.trim();
        if (!text) throw new Error('Empty transcript');

        const detectedLang: 'ar' | 'en' | 'mixed' = sttData.language ?? 'ar';
        setTranscript(text);

        isProcessingRef.current = false;
        const result = await sendMessage(text, { voice_mode: true, detected_language: detectedLang });
        setTranscript('');

        if (result?.message) {
          try {
            await speakMessage(result.message, result.suggested_emotion ?? 'neutral', true);
          } catch {
            if ('speechSynthesis' in window) {
              const utter = new SpeechSynthesisUtterance(result.message);
              utter.lang = /[؀-ۿ]/.test(result.message) ? 'ar-SA' : 'en-US';
              utter.rate = 0.95;
              window.speechSynthesis.speak(utter);
            }
          }
        }
      } catch (err: any) {
        console.error('[VoicePanel] pipeline error:', err);
        isProcessingRef.current = false;
        setMode('idle');
        setTranscript('');
        toast({ title: lang === 'ar' ? 'ما قدرت أسمعك، عيد مرة ثانية' : 'Couldn\'t hear you, please try again', variant: 'destructive' });
      }
    };

    mr.start(250);
    setMode('listening');
  }, [session, sendMessage, speakMessage, toast]);

  const stopRecording = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (!mr || mr.state === 'inactive') return;
    try { mr.stop(); } catch { /* already stopped */ }
  }, []);

  const handleMicPress = () => {
    if (mode === 'speaking') { stopSpeaking(); return; }
    if (mode === 'listening') { stopRecording(); return; }
    if (mode === 'idle') startRecording();
  };

  const replay = () => {
    const last = messages[messages.length - 1];
    if (last?.role === 'assistant' && mode === 'idle') {
      speakMessage(last.content, 'neutral', false);
    }
  };

  useEffect(() => () => { stopRecording(); streamRef.current?.getTracks().forEach(t => t.stop()); }, [stopRecording]);

  const cfg = MODE_CONFIG[mode];
  const isActive = mode === 'listening' || mode === 'speaking';
  // Gender-aware label for idle mode
  const idleArLabel = gender === 'female' ? 'اضغطي للتحدث مع جود' : 'اضغط للتحدث مع جود';
  const cfgAr = mode === 'idle' ? idleArLabel : cfg.ar;

  return (
    <div className="flex flex-col items-center gap-6 py-6 px-4">

      {/* The Jood Orb — tap to talk */}
      <div className="relative flex items-center justify-center">
        {/* Pulse rings */}
        {isActive && [0, 1, 2].map(i => (
          <motion.div
            key={i}
            className="absolute rounded-full border border-jood-gold-400/40"
            animate={{ scale: [1, 1.6 + i * 0.3], opacity: [0.6, 0] }}
            transition={{ duration: 2, repeat: Infinity, delay: i * 0.5, ease: 'easeOut' }}
            style={{ width: 150, height: 150 }}
          />
        ))}

        <button
          onClick={handleMicPress}
          disabled={mode === 'processing' || mode === 'thinking'}
          className={cn(
            'relative rounded-full transition-all select-none',
            'disabled:opacity-60 disabled:cursor-not-allowed',
            mode === 'idle' && 'hover:scale-105',
            mode === 'listening' && 'scale-105',
          )}
          aria-label={lang === 'ar' ? 'تحدث مع جود' : 'Talk to Jood'}
        >
          <JoodOrb
            mode={mode === 'processing' ? 'thinking' : mode}
            intensity={0}
            size={140}
            withRings={false}
          />
          {/* Mic state hint overlaid at bottom edge of orb */}
          <span className={cn(
            'absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full p-1.5',
            'bg-jood-teal-900/80 border border-jood-gold-500/40 backdrop-blur-sm',
            mode === 'listening' ? 'text-red-400' : 'text-jood-gold-300',
          )}>
            {mode === 'listening'
              ? <MicOff className="w-3.5 h-3.5" />
              : <Mic className="w-3.5 h-3.5" />
            }
          </span>
        </button>
      </div>

      {/* Visualizer */}
      <div className="h-10 flex items-center justify-center">
        {mode === 'processing' || mode === 'thinking'
          ? <ThinkingDots />
          : <WaveformBars active={isActive} />
        }
      </div>

      {/* Status label */}
      <AnimatePresence mode="wait">
        <motion.p
          key={mode}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="text-base font-arabic font-semibold text-foreground text-center"
        >
          {lang === 'ar' ? cfgAr : cfg.en}
        </motion.p>
      </AnimatePresence>

      {/* Live transcript */}
      <AnimatePresence>
        {transcript && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="w-full max-w-sm bg-muted/60 border border-border/50 rounded-2xl px-4 py-3"
          >
            <p className="text-sm font-arabic text-center text-foreground/80 leading-relaxed">{transcript}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Conversation history (last 4 messages) */}
      {lastMessages.length > 0 && !transcript && (
        <div className="w-full max-w-sm space-y-2">
          {lastMessages.map(msg => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'px-3 py-2 rounded-xl text-xs font-arabic leading-relaxed',
                msg.role === 'user'
                  ? 'bg-jood-teal-700/15 text-jood-teal-900 dark:text-jood-teal-300 text-right mr-4'
                  : 'bg-card border border-border/40 text-foreground ml-4',
              )}
            >
              {msg.content}
            </motion.div>
          ))}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          onClick={replay}
          disabled={!messages.some(m => m.role === 'assistant') || mode !== 'idle'}
          className="rounded-full h-10 w-10"
          title={lang === 'ar' ? 'إعادة الاستماع' : 'Replay'}
        >
          <Volume2 className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => { stopSpeaking(); stopRecording(); setMode('idle'); setTranscript(''); }}
          disabled={mode === 'idle'}
          className="rounded-full h-10 w-10"
          title={lang === 'ar' ? 'إعادة التعيين' : 'Reset'}
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Hint */}
      <p className="text-[10px] text-muted-foreground text-center font-arabic">
        {mode === 'idle'
          ? (lang === 'ar' ? (gender === 'female' ? 'اضغطي المايك للتحدث · للمجلس الكامل استخدمي الزر أعلاه' : 'اضغط المايك للتحدث · للمجلس الكامل استخدم الزر أعلاه') : 'Tap the mic to talk · For full session use the button above')
          : mode === 'listening'
          ? (lang === 'ar' ? (gender === 'female' ? 'اضغطي مجدداً عند الانتهاء' : 'اضغط مجدداً عند الانتهاء') : 'Tap again when done')
          : mode === 'speaking'
          ? (lang === 'ar' ? (gender === 'female' ? 'اضغطي المايك لمقاطعة جود' : 'اضغط المايك لمقاطعة جود') : 'Tap the mic to interrupt Jood')
          : ''}
      </p>

      {/* Brand signature — no internal tech jargon in the product UI */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/40 rounded-full">
        <Sparkles className="w-3 h-3 text-jood-gold-500" />
        <span className="text-[10px] text-muted-foreground font-arabic">
          {lang === 'ar' ? 'جود — ذكاء سعودي' : 'Jood — Saudi Intelligence'}
        </span>
      </div>
    </div>
  );
};

export default VoicePanel;
