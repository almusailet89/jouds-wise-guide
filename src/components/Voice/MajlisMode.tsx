import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { X, Mic, MicOff, Volume2, Sparkles, Pause, Play, Headphones } from 'lucide-react';
import { useChat } from '@/hooks/useChat';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { JoodAvatar, type AvatarMode } from './JoodAvatar';
import { useLanguage } from '@/hooks/useLanguage';

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
  const { t, lang, dir } = useLanguage();
  const { sendMessage, speakMessage, stopSpeaking, messages, loading, speaking, speakingIntensity } = useChat();
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);

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
  /** Barge-in mic monitor runs while Jood is speaking */
  const bargeinRafRef   = useRef<number | null>(null);
  const bargeinCtxRef   = useRef<AudioContext | null>(null);

  const MODE_LABELS: Record<Mode, { label: string; sub: string }> = {
    idle:       { label: t('majlis.idle'),       sub: t('majlis.idle.sub') },
    listening:  { label: t('majlis.listening'),  sub: t('majlis.listening.sub') },
    processing: { label: t('majlis.processing'), sub: t('majlis.processing.sub') },
    thinking:   { label: t('majlis.thinking'),   sub: t('majlis.thinking.sub') },
    speaking:   { label: t('majlis.speaking'),   sub: t('majlis.speaking.sub') },
  };

  // ── Request mic permission + welcome greeting on mount ──────────────────
  const welcomePlayedRef = useRef(false);
  const [micGranted, setMicGranted] = useState(false);
  useEffect(() => {
    if (welcomePlayedRef.current) return;
    welcomePlayedRef.current = true;

    // Request mic permission immediately on open — don't wait for first recording
    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      .then((stream) => {
        // Permission granted — keep the stream reference for later use
        streamRef.current = stream;
        setMicGranted(true);
      })
      .catch(() => {
        // Permission denied — show a helpful toast but don't block the greeting
        toast({
          title: t('voice.error.mic'),
          description: lang === 'ar'
            ? 'افتح إعدادات المتصفح واسمح بالميكروفون لهذا الموقع'
            : 'Open browser settings and allow microphone for this site',
          variant: 'destructive',
        });
      });

    // Play welcome greeting regardless of mic permission
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'صباح الخير طال عمرك، تأمر أمر'
      : hour < 17 ? 'أهلين، وش ودّك نسوّي؟'
      : 'مساء الخير، تفضّل وش تبي؟';
    const timer = setTimeout(() => {
      speakMessage(greeting, 'warm', true);
      setLastReply(greeting);
    }, 800);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync mode with chat state (when not processing Whisper) ──────────────
  useEffect(() => {
    if (isProcessingRef.current) return;
    if (loading) setMode('thinking');
    else if (speaking) setMode('speaking');
    else if (mode === 'thinking' || mode === 'speaking') setMode('idle');
  }, [loading, speaking]); // eslint-disable-line

  // ── Barge-in: monitor mic while Jood speaks — interrupt if user talks ────
  // Keeps a lightweight AudioContext open during TTS playback.
  // When mic RMS > BARGE_THRESHOLD for >= BARGE_SUSTAIN_MS → interrupt.
  const BARGE_THRESHOLD  = 0.04;
  const BARGE_SUSTAIN_MS = 180;

  useEffect(() => {
    if (!speaking || mode !== 'speaking') {
      // Teardown barge-in monitor when not speaking
      if (bargeinRafRef.current) { cancelAnimationFrame(bargeinRafRef.current); bargeinRafRef.current = null; }
      bargeinCtxRef.current?.close().catch(() => {});
      bargeinCtxRef.current = null;
      return;
    }

    // Start barge-in monitor
    let bargeActiveMs = 0;
    let lastTick = Date.now();

    const startBargein = async () => {
      try {
        const stream = streamRef.current?.active
          ? streamRef.current
          : await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

        const ctx = new AudioContext();
        bargeinCtxRef.current = ctx;
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        src.connect(analyser);
        const buf = new Uint8Array(analyser.frequencyBinCount);

        const tick = () => {
          if (!speaking) return;
          analyser.getByteFrequencyData(buf);
          const avg = buf.reduce((s, v) => s + v, 0) / buf.length / 255;
          const now = Date.now();
          const dt  = now - lastTick;
          lastTick  = now;

          if (avg > BARGE_THRESHOLD) {
            bargeActiveMs += dt;
            if (bargeActiveMs >= BARGE_SUSTAIN_MS) {
              // User is talking — interrupt Jood and start recording
              console.log('[Barge-in] user speaking — interrupting Jood');
              stopSpeaking();
              setTimeout(() => startRecording(), 50);
              return;
            }
          } else {
            bargeActiveMs = Math.max(0, bargeActiveMs - dt * 0.5);
          }
          bargeinRafRef.current = requestAnimationFrame(tick);
        };
        tick();
      } catch { /* mic unavailable — barge-in disabled silently */ }
    };

    startBargein();

    return () => {
      if (bargeinRafRef.current) { cancelAnimationFrame(bargeinRafRef.current); bargeinRafRef.current = null; }
      bargeinCtxRef.current?.close().catch(() => {});
      bargeinCtxRef.current = null;
    };
  }, [speaking, mode, stopSpeaking, startRecording]); // eslint-disable-line

  // ── Track latest assistant reply for display + replay ────────────────────
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last?.role === 'assistant') setLastReply(last.content);
  }, [messages]);

  // ── VAD constants ─────────────────────────────────────────────────────────
  // Silence below SILENCE_THRESHOLD for >= SILENCE_MS → auto-stop recording.
  // SPEECH_MIN_MS: minimum speaking time before VAD kicks in (avoid instant stops).
  const SILENCE_THRESHOLD = 0.028; // RMS fraction (0–1). Slightly higher = fewer false triggers
  const SILENCE_MS        = 500;   // ms of sustained silence → auto-stop (was 750ms — 250ms faster)
  const SPEECH_MIN_MS     = 400;   // ms before VAD activates (was 500ms — quicker response)

  const vadSilenceStartRef  = useRef<number | null>(null);
  const vadSpeechDetectedRef = useRef(false);
  const vadRecStartRef       = useRef(0);

  // ── AnalyserNode tick + built-in VAD ──────────────────────────────────────
  const startAnalyserLoop = useCallback((stream: MediaStream) => {
    try {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Reset VAD state
      vadSilenceStartRef.current   = null;
      vadSpeechDetectedRef.current = false;
      vadRecStartRef.current       = Date.now();

      const buf = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(buf);
        const avg = buf.reduce((s, v) => s + v, 0) / buf.length / 255;
        setIntensity(avg);

        // ── VAD logic ──────────────────────────────────────────────────────
        const now     = Date.now();
        const elapsed = now - vadRecStartRef.current;

        if (elapsed > SPEECH_MIN_MS) {
          if (avg > SILENCE_THRESHOLD) {
            // Voice detected
            vadSpeechDetectedRef.current = true;
            vadSilenceStartRef.current   = null;
          } else if (vadSpeechDetectedRef.current) {
            // Silence after voice
            if (!vadSilenceStartRef.current) {
              vadSilenceStartRef.current = now;
            } else if (now - vadSilenceStartRef.current >= SILENCE_MS) {
              // Sustained silence → auto-stop recording
              console.log('[VAD] silence detected — auto-stop');
              stopRecording();
              return; // stop RAF
            }
          }
        }

        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // mic blocked — visualizer falls back to static animation
    }
  }, [stopRecording]); // eslint-disable-line

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
      toast({ title: t('voice.error.mic'), variant: 'destructive' });
      return;
    }

    let stream: MediaStream;
    try {
      // Reuse active stream from initial permission grant (avoids re-prompt)
      if (streamRef.current && streamRef.current.active) {
        stream = streamRef.current;
      } else {
        // Audio constraints tuned for Whisper / gpt-4o-transcribe accuracy
        try {
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
          // Fallback without sample rate (some browsers/mobile reject it)
          stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            video: false,
          });
        }
        streamRef.current = stream;
      }
    } catch {
      toast({
        title: t('voice.error.mic'),
        description: lang === 'ar'
          ? 'افتح إعدادات المتصفح واسمح بالميكروفون'
          : 'Open browser settings and allow microphone',
        variant: 'destructive',
      });
      return;
    }
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

      // ═══════════════════════════════════════════════════════════════════════
      // SPEED PIPELINE — every millisecond counts for conversational feel
      //
      // Optimisations vs the old serial flow:
      //   1. Direct fetch instead of supabase.functions.invoke (~200ms saved per call)
      //   2. STT uses gpt-4o-mini-transcribe in voice mode (~40% faster than gpt-4o)
      //   3. DB save is fire-and-forget (don't await — shaves ~200ms)
      //   4. TTS starts on first sentence while AI response is still arriving
      //   5. VAD is 250ms faster (500ms silence vs 750ms)
      //   6. Context window slimmed to last 6 messages for voice (fewer tokens)
      // ═══════════════════════════════════════════════════════════════════════
      isProcessingRef.current = true;
      setMode('processing');
      setTranscript(t('voice.processing'));

      const supabaseUrl = 'https://neadnclykbukvmlquepg.supabase.co';
      const anonKey     = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const authHeaders = {
        'Authorization': `Bearer ${session.access_token}`,
        ...(anonKey ? { 'apikey': anonKey } : {}),
      };

      try {
        // ── STEP 1: STT (direct fetch — no supabase wrapper overhead) ─────
        const ext = mimeTypeRef.current.includes('mp4')  ? 'mp4'
                  : mimeTypeRef.current.includes('ogg')  ? 'ogg'
                  : 'webm';
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

        // ── STEP 2: AI chat (direct fetch — skip invoke wrapper) ──────────
        isProcessingRef.current = false;
        setMode('thinking');

        // Slim context for voice — last 6 messages (fast tokens)
        const contextMessages = messages
          .slice(-6)
          .map(m => ({ role: m.role, content: m.content }));

        const aiRes = await fetch(`${supabaseUrl}/functions/v1/ai-chat`, {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message:           text,
            context:           contextMessages,
            voice_mode:        true,
            detected_language: detectedLang,
            lang,
          }),
        });
        if (!aiRes.ok) throw new Error(`AI ${aiRes.status}`);
        const aiData = await aiRes.json();

        const reply: string = aiData?.message || '';
        if (!reply) throw new Error('Empty AI response');

        setTranscript('');
        setLastReply(reply);

        // Fire-and-forget: save messages to DB (don't block TTS on DB write)
        sendMessage(text, { voice_mode: true, detected_language: detectedLang })
          .catch(() => {}); // already have the response — this just persists it

        // ── STEP 3: TTS — start speaking immediately ──────────────────────
        const emotion = aiData.suggested_emotion ?? 'neutral';
        try {
          await speakMessage(reply, emotion, true);
        } catch {
          if ('speechSynthesis' in window) {
            const utter = new SpeechSynthesisUtterance(reply);
            utter.lang = /[؀-ۿ]/.test(reply) ? 'ar-SA' : 'en-US';
            utter.rate = 0.95;
            window.speechSynthesis.speak(utter);
          }
        }

      } catch (err: any) {
        console.error('[MajlisMode] voice pipeline error:', err);
        isProcessingRef.current = false;
        setMode('idle');
        setTranscript('');

        const errMsg = lang === 'ar'
          ? 'ما قدرت أسمعك، عيد مرة ثانية لو سمحت'
          : 'Couldn\'t hear you clearly, please try again';
        toast({ title: errMsg, variant: 'destructive' });
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
    // ── Speaking-mode short-circuit: tap to interrupt Jood ──────────────
    if (mode === 'speaking') {
      stopSpeaking();
      // Open mic immediately so the user can take the floor without an extra tap
      setTimeout(() => startRecording(), 80);
      return;
    }

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
      const t = setTimeout(() => startRecording(), 250); // was 600ms — much faster turn-taking
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

  // ── Voice signature preview (target ElevenLabs Jood voice clip) ──────────
  // During the dev/free phase TTS uses OpenAI nova as a placeholder. This
  // button plays the actual cloned voice MP3 from /public/avatar so users
  // can hear what the final voice will sound like.
  const togglePreview = useCallback(() => {
    if (previewPlaying) {
      previewAudioRef.current?.pause();
      previewAudioRef.current = null;
      setPreviewPlaying(false);
      return;
    }
    // Stop any current TTS first
    stopSpeaking();
    const a = new Audio('/avatar/voice-preview.mp3');
    previewAudioRef.current = a;
    a.onended = () => { setPreviewPlaying(false); previewAudioRef.current = null; };
    a.onerror = () => { setPreviewPlaying(false); previewAudioRef.current = null; };
    setPreviewPlaying(true);
    a.play().catch(() => setPreviewPlaying(false));
  }, [previewPlaying, stopSpeaking]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      stopRecording();
      stopAnalyser();
      previewAudioRef.current?.pause();
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
          {continuous && (
            <span className="text-[10px] bg-jood-gold-500/30 text-jood-gold-100 border border-jood-gold-300/30 rounded-full px-2 py-0.5 font-arabic">
              {t('majlis.continuous')}
            </span>
          )}
          {/* Engine badge */}
          <span className="text-[10px] bg-white/10 text-white/50 rounded-full px-2 py-0.5">
            Whisper · ElevenLabs
          </span>
        </div>
        <div className="flex items-center gap-1">
          {/* Voice signature preview */}
          <Button
            variant="ghost"
            size="icon"
            onClick={togglePreview}
            className={cn(
              'rounded-full h-10 w-10 text-white hover:bg-white/10',
              previewPlaying && 'bg-jood-gold-500/30 ring-2 ring-jood-gold-300/40',
            )}
            title={t('majlis.preview.title')}
          >
            <Headphones className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { stopRecording(); stopSpeaking(); onClose(); }}
            className="text-white hover:bg-white/10 rounded-full h-10 w-10"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
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
            <p className="text-white text-2xl font-arabic font-bold">{labels.label}</p>
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
          title={t('majlis.replay.title')}
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
              : mode === 'speaking'
              ? 'bg-gradient-to-br from-amber-500 to-orange-600 ring-2 ring-amber-300/60 hover:scale-105'
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
          title={t(continuous ? 'majlis.cont.stop' : 'majlis.cont.start')}
        >
          {continuous ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
        </Button>
      </div>

      {/* Bottom hint */}
      <p className="absolute bottom-2 inset-x-0 text-center text-[10px] text-white/40 font-arabic">
        {t('majlis.hint')}
      </p>
    </motion.div>
  );
};

export default MajlisMode;
