import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { X, Mic, MicOff, Sparkles, Phone, PhoneOff } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { JoodAvatar, type AvatarMode } from './JoodAvatar';
import { useLanguage } from '@/hooks/useLanguage';
import { Conversation } from '@11labs/client';

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

// ─── Mode types ──────────────────────────────────────────────────────────────
type Mode = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking';

interface MajlisModeAgentProps {
  onClose: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MajlisMode powered by ElevenLabs Conversational AI
//
// Architecture:
//   1. User opens Majlis → we fetch a signed WebSocket URL from our edge function
//   2. ElevenLabs SDK opens a direct WebSocket to their Conversational AI
//   3. Everything happens in real-time over that single connection:
//      - STT (user speech → text)
//      - LLM (your GPT-4o with Jood personality via agent config)
//      - TTS (clone voice rx14CzWiL77Roff1cjW6 → audio stream)
//   4. First word of Jood's response plays in < 1 second
//   5. Natural barge-in — user can interrupt Jood mid-sentence
//
// ═══════════════════════════════════════════════════════════════════════════════

export const MajlisModeAgent: React.FC<MajlisModeAgentProps> = ({ onClose }) => {
  const { session } = useAuth();
  const { toast } = useToast();
  const { t, lang, dir } = useLanguage();

  const [mode, setMode] = useState<Mode>('idle');
  const [transcript, setTranscript] = useState('');       // User's speech (live)
  const [lastReply, setLastReply] = useState('');          // Jood's last response
  const [isMuted, setIsMuted] = useState(false);
  const [intensity, setIntensity] = useState(0);
  const [connected, setConnected] = useState(false);

  const conversationRef = useRef<any>(null);
  const intensityIntervalRef = useRef<number | null>(null);

  const MODE_LABELS: Record<Mode, { label: string; sub: string }> = {
    idle:       { label: t('majlis.idle'),       sub: lang === 'ar' ? 'اضغطي الاتصال للبدء' : 'Press call to start' },
    connecting: { label: lang === 'ar' ? 'جاري الاتصال…' : 'Connecting…', sub: lang === 'ar' ? 'تحضير جود…' : 'Preparing Jood…' },
    listening:  { label: t('majlis.listening'),  sub: t('majlis.listening.sub') },
    thinking:   { label: t('majlis.thinking'),   sub: t('majlis.thinking.sub') },
    speaking:   { label: t('majlis.speaking'),   sub: t('majlis.speaking.sub') },
  };

  // ── Get signed URL from our edge function ───────────────────────────────────
  const getSignedUrl = useCallback(async (): Promise<string> => {
    const supabaseUrl = 'https://neadnclykbukvmlquepg.supabase.co';
    const anonKey     = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const res = await fetch(`${supabaseUrl}/functions/v1/elevenlabs-agent-sign`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session?.access_token}`,
        'Content-Type':  'application/json',
        ...(anonKey ? { apikey: anonKey } : {}),
      },
    });

    if (!res.ok) throw new Error(`Sign URL failed: ${res.status}`);
    const data = await res.json();
    if (!data.signed_url) throw new Error('No signed URL returned');
    return data.signed_url;
  }, [session]);

  // ── Start conversation with ElevenLabs Agent ────────────────────────────────
  const startConversation = useCallback(async () => {
    if (!session) return;
    setMode('connecting');

    try {
      // Request mic permission
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Get signed URL (auth gateway)
      const signedUrl = await getSignedUrl();

      // Start the ElevenLabs conversation — pass user_id so webhook tools know who's talking
      const conversation = await Conversation.startSession({
        signedUrl,
        dynamicVariables: {
          user_id: session.user.id,
        },
        onConnect: () => {
          console.log('[Majlis Agent] Connected');
          setConnected(true);
          setMode('listening');
        },
        onDisconnect: () => {
          console.log('[Majlis Agent] Disconnected');
          setConnected(false);
          setMode('idle');
          setTranscript('');
        },
        onMessage: (message: any) => {
          // Agent message (Jood's response text)
          if (message.message) {
            setLastReply(message.message);
          }
        },
        onError: (error: any) => {
          console.error('[Majlis Agent] Error:', error);
          toast({
            title: lang === 'ar' ? 'خطأ في الاتصال' : 'Connection error',
            description: String(error),
            variant: 'destructive',
          });
          setMode('idle');
          setConnected(false);
        },
        onModeChange: (modeChange: any) => {
          // ElevenLabs reports: 'listening' | 'speaking'
          const agentMode = modeChange.mode;
          if (agentMode === 'listening') {
            setMode('listening');
          } else if (agentMode === 'speaking') {
            setMode('speaking');
          }
        },
      });

      conversationRef.current = conversation;

      // Simulate intensity from conversation volume
      intensityIntervalRef.current = window.setInterval(() => {
        if (conversationRef.current) {
          try {
            const vol = conversationRef.current.getInputVolume?.() ?? 0;
            const outVol = conversationRef.current.getOutputVolume?.() ?? 0;
            setIntensity(Math.max(vol, outVol));
          } catch {
            setIntensity(0);
          }
        }
      }, 100);

    } catch (err: any) {
      console.error('[Majlis Agent] Start error:', err);

      if (err.name === 'NotAllowedError' || err.message?.includes('permission')) {
        toast({
          title: lang === 'ar' ? 'تعذّر الوصول للميكروفون' : 'Microphone access denied',
          description: lang === 'ar'
            ? 'افتح إعدادات المتصفح واسمح بالميكروفون لهذا الموقع'
            : 'Allow microphone access in browser settings',
          variant: 'destructive',
        });
      } else {
        toast({
          title: lang === 'ar' ? 'تعذّر الاتصال بجود' : 'Could not connect to Jood',
          description: String(err.message || err),
          variant: 'destructive',
        });
      }
      setMode('idle');
    }
  }, [session, getSignedUrl, toast, lang]);

  // ── End conversation ────────────────────────────────────────────────────────
  const endConversation = useCallback(async () => {
    if (intensityIntervalRef.current) {
      clearInterval(intensityIntervalRef.current);
      intensityIntervalRef.current = null;
    }
    if (conversationRef.current) {
      try { await conversationRef.current.endSession(); } catch { /* ignore */ }
      conversationRef.current = null;
    }
    setConnected(false);
    setMode('idle');
    setIntensity(0);
  }, []);

  // ── Toggle mute ─────────────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    if (!conversationRef.current) return;
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    if (newMuted) {
      conversationRef.current.setVolume?.({ volume: 0 });
    } else {
      conversationRef.current.setVolume?.({ volume: 1 });
    }
  }, [isMuted]);

  // ── Cleanup on unmount ──────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      endConversation();
    };
  }, [endConversation]);

  const labels = MODE_LABELS[mode];
  const isActive = mode === 'listening' || mode === 'speaking';

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
          {connected && (
            <span className="text-[10px] bg-green-500/30 text-green-100 border border-green-300/30 rounded-full px-2 py-0.5 font-arabic animate-pulse">
              {lang === 'ar' ? 'متصل' : 'Connected'}
            </span>
          )}
          <span className="text-[10px] bg-white/10 text-white/50 rounded-full px-2 py-0.5">
            ElevenLabs Agent
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => { endConversation(); onClose(); }}
          className="text-white hover:bg-white/10 rounded-full h-10 w-10"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* ── Center: Avatar + Visualizer ──────────────────────────────────── */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-6">

        {/* Pulse rings + avatar */}
        <div className="relative w-80 h-80 flex items-center justify-center">
          <PulseRings active={isActive} intensity={intensity} />
          <JoodAvatar
            mode={(mode === 'connecting' ? 'thinking' : mode === 'idle' ? 'idle' : mode) as AvatarMode}
            intensity={intensity}
            size={280}
            className="relative z-10"
          />
        </div>

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

        {/* Live transcript */}
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

        {/* Last AI reply */}
        <AnimatePresence>
          {!transcript && lastReply && (mode === 'speaking' || mode === 'listening' || mode === 'idle') && (
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

        {/* Mute toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleMute}
          disabled={!connected}
          className={cn(
            'rounded-full h-12 w-12 flex-shrink-0 text-white hover:bg-white/10 disabled:opacity-30',
            isMuted && 'bg-red-500/20 border border-red-300/40',
          )}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </Button>

        {/* ── Main call button ──────────────────────────────────────────── */}
        <button
          onClick={connected ? endConversation : startConversation}
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
      <p className="absolute bottom-2 inset-x-0 text-center text-[10px] text-white/40 font-arabic">
        {connected
          ? (lang === 'ar' ? 'تحدث بشكل طبيعي — جود تسمعك وتجاوبك فوراً' : 'Speak naturally — Jood hears you and responds instantly')
          : (lang === 'ar' ? 'اضغطي زر الاتصال لبدء المحادثة مع جود' : 'Press the call button to start talking to Jood')
        }
      </p>
    </motion.div>
  );
};

export default MajlisModeAgent;
