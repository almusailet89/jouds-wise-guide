import { useCallback, useEffect, useRef, useState } from 'react';
import { Conversation } from '@11labs/client';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  checkMicAvailability, issueFromMediaError,
  type CallIssue, type MajlisEngine, type MajlisMode,
} from '@/components/Voice/majlisEngine';

// Majlis on ElevenLabs Conversational AI (premium voice). The agent's prompt,
// voice and webhook tools are configured in the ElevenLabs dashboard; the app
// only fetches a signed URL from the elevenlabs-agent-sign edge function.

type ElevenConversation = Awaited<ReturnType<typeof Conversation.startSession>>;

export function useElevenLabsMajlis(): MajlisEngine {
  const { session } = useAuth();

  const [mode, setMode] = useState<MajlisMode>('idle');
  const [transcript, setTranscript] = useState('');
  const [lastReply, setLastReply] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [intensity, setIntensity] = useState(0);
  const [connected, setConnected] = useState(false);
  const [issue, setIssue] = useState<CallIssue | null>(null);

  const conversationRef = useRef<ElevenConversation | null>(null);
  const meterRef = useRef<number | null>(null);
  const lastFlushRef = useRef(0);
  const firstFlushRef = useRef(true);

  const flushUsage = useCallback(async () => {
    if (!lastFlushRef.current) return;
    const now = Date.now();
    const seconds = Math.round((now - lastFlushRef.current) / 1000);
    lastFlushRef.current = now;
    const newSession = firstFlushRef.current;
    firstFlushRef.current = false;
    try {
      await (supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<unknown>)(
        'record_voice_usage', { p_seconds: seconds, p_engine: 'elevenlabs', p_new_session: newSession },
      );
    } catch { /* usage reporting must never break a call */ }
  }, []);

  const stopMeter = useCallback(() => {
    if (meterRef.current) { clearInterval(meterRef.current); meterRef.current = null; }
    setIntensity(0);
  }, []);

  const end = useCallback(async () => {
    stopMeter();
    await flushUsage();
    lastFlushRef.current = 0;
    if (conversationRef.current) {
      try { await conversationRef.current.endSession(); } catch { /* ignore */ }
      conversationRef.current = null;
    }
    setConnected(false);
    setIsMuted(false);
    setMode('idle');
  }, [flushUsage, stopMeter]);

  const start = useCallback(async () => {
    if (!session) return;
    setIssue(null);
    setMode('connecting');

    const preflight = await checkMicAvailability();
    if (preflight) { setIssue(preflight); setMode('idle'); return; }

    try {
      // Ask for permission, then release the probe stream at once; the SDK opens its own.
      const probe = await navigator.mediaDevices.getUserMedia({ audio: true });
      probe.getTracks().forEach(track => track.stop());
    } catch (err) {
      setIssue(issueFromMediaError(err));
      setMode('idle');
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke<{ signed_url?: string }>('elevenlabs-agent-sign');
      if (error || !data?.signed_url) throw error ?? new Error('No signed URL returned');

      const conversation = await Conversation.startSession({
        signedUrl: data.signed_url,
        dynamicVariables: { user_id: session.user.id },
        onConnect: () => {
          setConnected(true);
          setMode('listening');
          lastFlushRef.current = Date.now();
          firstFlushRef.current = true;
          void flushUsage();
        },
        onDisconnect: () => {
          stopMeter();
          void flushUsage();
          lastFlushRef.current = 0;
          conversationRef.current = null;
          setConnected(false);
          setIsMuted(false);
          setMode('idle');
          setTranscript('');
        },
        onMessage: ({ message, source }) => {
          if (!message) return;
          if (source === 'user') {
            setTranscript(message);
            setMode('thinking');
          } else {
            setTranscript('');
            setLastReply(message);
          }
        },
        onError: (err: unknown) => {
          console.error('[Majlis ElevenLabs] Error:', err);
          stopMeter();
          setIssue('connection');
          setMode('idle');
          setConnected(false);
        },
        onModeChange: ({ mode: agentMode }: { mode: string }) => {
          if (agentMode === 'listening') setMode('listening');
          else if (agentMode === 'speaking') setMode('speaking');
        },
      });
      conversationRef.current = conversation;

      meterRef.current = window.setInterval(() => {
        const c = conversationRef.current;
        if (!c) return;
        try {
          setIntensity(Math.max(c.getInputVolume?.() ?? 0, c.getOutputVolume?.() ?? 0));
        } catch {
          setIntensity(0);
        }
        if (lastFlushRef.current && Date.now() - lastFlushRef.current >= 30_000) void flushUsage();
      }, 100);
    } catch (err) {
      console.error('[Majlis ElevenLabs] Start error:', err);
      stopMeter();
      setIssue('connection');
      setMode('idle');
    }
  }, [session, flushUsage, stopMeter]);

  const toggleMute = useCallback(() => {
    if (!conversationRef.current) return;
    setIsMuted(prev => {
      const next = !prev;
      conversationRef.current?.setMicMuted?.(next);
      return next;
    });
  }, []);

  useEffect(() => () => { void end(); }, [end]);

  return { mode, transcript, lastReply, isMuted, intensity, connected, issue, secondsLeft: null, start, end, toggleMute };
}
