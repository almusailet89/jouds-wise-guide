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
  const { lang } = useLanguage();
  const { sendMessage, speakMessage, stopSpeaking, messages, loading, speaking, speakingIntensity } = useChat();

  const [mode, setMode] = useState<VoiceMode>('idle');
  const [transcript, setTranscript] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const mimeTypeRef = useRef<string>('audio/webm');
  const streamRef = useRef<MediaStream | null>(null);
  const isProcessingRef = useRef(false);

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
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch {
      toast({
        title: lang === 'ar' ? 'لا يمكن الوصول للميكروفون' : 'Microphone access denied',
        description: lang === 'ar' ? 'يرجى السماح بالوصول للميكروفون في إعدادات المتصفح' : 'Please allow microphone access in your browser settings',
        variant: 'destructive',
      });
      return;
    }

    streamRef.current = stream;
    chunksRef.current = [];
    const mimeType = getBestMimeType();
    mimeTypeRef.current = mimeType;

    const mr = new MediaRecorder(stream, mimeType ? { mimeType } : {});
    mediaRecorderRef.current = mr;

    mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };

    mr.onstop = async () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      mediaRecorderRef.current = null;

      const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current || 'audio/webm' });
      chunksRef.current = [];

      if (blob.size < 500) { isProcessingRef.current = false; setMode('idle'); return; }

      isProcessingRef.current = true;
      setMode('processing');
      setTranscript(MODE_CONFIG.processing[lang === 'ar' ? 'ar' : 'en']);

      try {
        const ext = mimeTypeRef.current.includes('mp4') ? 'mp4'
                  : mimeTypeRef.current.includes('ogg') ? 'ogg' : 'webm';
        const formData = new FormData();
        formData.append('audio', blob, `recording.${ext}`);

        const { data: sttData, error: sttErr } = await supabase.functions.invoke('whisper-transcribe', {
          body: formData,
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (sttErr || !sttData?.text?.trim()) throw new Error(sttErr?.message ?? 'Empty transcript');

        const text: string = sttData.text.trim();
        const lang: 'ar' | 'en' | 'mixed' = sttData.language ?? 'ar';
        setTranscript(text);

        isProcessingRef.current = false;
        const result = await sendMessage(text, { voice_mode: true, detected_language: lang });
        setTranscript('');

        if (result?.message) {
          await speakMessage(result.message, result.suggested_emotion ?? 'neutral', true);
        }
      } catch (err: any) {
        console.error('[VoicePanel] pipeline error:', err);
        isProcessingRef.current = false;
        setMode('idle');
        setTranscript('');
        toast({ title: lang === 'ar' ? 'لم أستطع التعرف على صوتك' : 'Could not recognize your voice', description: lang === 'ar' ? 'حاولي مجدداً' : 'Please try again', variant: 'destructive' });
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

  return (
    <div className="flex flex-col items-center gap-6 py-6 px-4">

      {/* Avatar orb + mic button */}
      <div className="relative flex items-center justify-center">
        {/* Pulse rings */}
        {isActive && [0, 1, 2].map(i => (
          <motion.div
            key={i}
            className="absolute rounded-full border border-jood-gold-400/40"
            animate={{ scale: [1, 1.6 + i * 0.3], opacity: [0.6, 0] }}
            transition={{ duration: 2, repeat: Infinity, delay: i * 0.5, ease: 'easeOut' }}
            style={{ width: 120, height: 120 }}
          />
        ))}

        <button
          onClick={handleMicPress}
          disabled={mode === 'processing' || mode === 'thinking'}
          className={cn(
            'relative w-28 h-28 rounded-full flex items-center justify-center transition-all shadow-luxury',
            'select-none disabled:opacity-50 disabled:cursor-not-allowed',
            `bg-gradient-to-br ${cfg.color}`,
            mode === 'listening' && 'scale-110',
            mode === 'idle' && 'hover:scale-105',
          )}
        >
          {mode === 'listening'
            ? <MicOff className="w-10 h-10 text-white" />
            : <Mic className="w-10 h-10 text-white" />
          }
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
          {lang === 'ar' ? cfg.ar : cfg.en}
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
          ? (lang === 'ar' ? 'اضغطي المايك للتحدث · للمجلس الكامل استخدمي الزر أعلاه' : 'Tap the mic to talk · For full session use the button above')
          : mode === 'listening'
          ? (lang === 'ar' ? 'اضغطي مجدداً عند الانتهاء' : 'Tap again when done')
          : mode === 'speaking'
          ? (lang === 'ar' ? 'اضغطي المايك لمقاطعة جود' : 'Tap the mic to interrupt Jood')
          : ''}
      </p>

      {/* Engine badge */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/40 rounded-full">
        <Sparkles className="w-3 h-3 text-jood-gold-500" />
        <span className="text-[10px] text-muted-foreground">Whisper · ElevenLabs · GPT-5</span>
      </div>
    </div>
  );
};
