import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { useLanguage } from './useLanguage';

export interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count?: number;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  pending?: boolean;
  action_card?: {
    kind:
      | 'task' | 'task_update' | 'task_delete'
      | 'event' | 'event_update' | 'event_delete'
      | 'email_draft' | 'whatsapp_draft'
      | 'finance' | 'finance_update' | 'finance_delete'
      | 'goal' | 'goal_update' | 'goal_delete'
      | 'holding_update' | 'holding_delete'
      | 'habit_update' | 'habit_delete'
      | 'budget' | 'portfolio' | 'memory'
      | (string & {}); // allow future kinds without TS errors
    summary: string;
    data: Record<string, any>;
  } | null;
}

// ─── sendMessage options (replaces positional mode/pendingFunction args) ────────
export interface SendMessageOpts {
  /** Internal confirmation flow mode: 'commit' | 'preview' */
  mode?: string;
  /** Existing pending function for multi-turn confirmation */
  pendingFunction?: any;
  /** true = voice-mode rules (brevity ≤15 words, no markdown) */
  voice_mode?: boolean;
  /** Language detected by Whisper: "ar" | "en" | "mixed" */
  detected_language?: 'ar' | 'en' | 'mixed';
}

// ─── ai-chat edge function response shape ────────────────────────────────────
export interface AIChatResponse {
  message: string;
  model_used?: string;
  voice_mode?: boolean;
  detected_language?: string;
  /** ElevenLabs emotion hint: "neutral" | "warm" | "confident" | "empathetic" */
  suggested_emotion?: string;
  /** Phase 2: classified response mode */
  response_mode?: 'command' | 'conversation' | 'finance' | 'mood' | 'planning';
  function_results?: {
    preview_mode?: boolean;
    function_call?: any;
  };
  /** Phase 4: navigation action — frontend should switch to this tab */
  navigate_to?: string;
  mode?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
export const useChat = () => {
  const { session } = useAuth();
  const { toast } = useToast();
  const { lang } = useLanguage();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [speakingIntensity, setSpeakingIntensity] = useState(0); // 0..1 — TTS audio amplitude for avatar lip-sync
  const [pendingFunction, setPendingFunction] = useState<any>(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  // ── Refs for TTS audio analyser pipeline (lip-sync illusion) ─────────────
  const ttsAudioCtxRef = useRef<AudioContext | null>(null);
  const ttsAudioElRef  = useRef<HTMLAudioElement | null>(null);
  const ttsRafRef      = useRef<number | null>(null);

  // ── Session management ────────────────────────────────────────────────────
  const loadSessions = useCallback(async () => {
    if (!session?.user?.id) return;
    setSessionsLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('chat_sessions')
        .select('id, title, created_at, updated_at')
        .eq('user_id', session.user.id)
        .order('updated_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setSessions(data || []);
    } catch (err) {
      console.error('Error loading sessions:', err);
    } finally {
      setSessionsLoading(false);
    }
  }, [session?.user?.id]);

  const createSession = useCallback(async (firstMessage?: string): Promise<string> => {
    if (!session?.user?.id) throw new Error('Not authenticated');

    const title = firstMessage
      ? firstMessage.slice(0, 60) + (firstMessage.length > 60 ? '…' : '')
      : 'محادثة جديدة';

    const { data, error } = await (supabase as any)
      .from('chat_sessions')
      .insert({ user_id: session.user.id, title })
      .select('id')
      .single();

    if (error) throw error;
    const newId = data.id;
    setCurrentSessionId(newId);
    await loadSessions();
    return newId;
  }, [session?.user?.id, loadSessions]);

  const loadMessages = useCallback(async (sessionId: string) => {
    setCurrentSessionId(sessionId);
    setMessages([]);
    setPendingFunction(null);
    setAwaitingConfirmation(false);

    const { data, error } = await (supabase as any)
      .from('chat_messages')
      .select('id, session_id, role, content, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading messages:', error);
      return;
    }
    setMessages(data || []);
  }, []);

  const saveMessage = async (
    sessionId: string,
    role: 'user' | 'assistant',
    content: string,
  ): Promise<string> => {
    const { data, error } = await (supabase as any)
      .from('chat_messages')
      .insert({ session_id: sessionId, role, content, user_id: session?.user?.id })
      .select('id')
      .single();

    if (error) throw error;

    // Bump session updated_at
    await (supabase as any)
      .from('chat_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', sessionId);

    return data.id;
  };

  // ── Core chat ─────────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (
    text: string,
    opts?: SendMessageOpts,
  ): Promise<AIChatResponse | undefined> => {
    if (!session || loading) return;
    const messageText = text.trim();
    if (!messageText) return;

    setLoading(true);

    const {
      mode,
      pendingFunction: existingPendingFunction,
      voice_mode = false,
      detected_language,          // undefined = let edge function detect from message content
    } = opts ?? {};

    try {
      // Ensure session
      let sessionId = currentSessionId;
      if (!sessionId) {
        sessionId = await createSession(messageText);
      }

      // Optimistic user message
      const userTempId = `temp-user-${Date.now()}`;
      setMessages(prev => [...prev, {
        id: userTempId,
        session_id: sessionId!,
        role: 'user',
        content: messageText,
        created_at: new Date().toISOString(),
      }]);

      await saveMessage(sessionId!, 'user', messageText);

      // Last-10 context window — keeps prompt lean for speed
      const contextMessages = messages
        .slice(-10)
        .map(m => ({ role: m.role, content: m.content }));

      // ── ai-chat edge function ──────────────────────────────────────────────
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          message: messageText,
          context: contextMessages,
          session_id: sessionId,
          mode,
          pendingFunction: existingPendingFunction,
          voice_mode,
          detected_language,
          lang,                   // app UI language — tells Jood which language to reply in
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;

      const aiText: string = data?.message || 'مرحباً، أنا جود. كيف يمكنني مساعدتك؟';

      const aiId = await saveMessage(sessionId!, 'assistant', aiText);

      setMessages(prev => [
        ...prev.filter(m => m.id !== userTempId),
        {
          id: `user-${Date.now()}`,
          session_id: sessionId!,
          role: 'user',
          content: messageText,
          created_at: new Date().toISOString(),
        },
        {
          id: aiId,
          session_id: sessionId!,
          role: 'assistant',
          content: aiText,
          created_at: new Date().toISOString(),
          action_card: data?.action_card ?? null,
        },
      ]);

      if (data?.function_results?.preview_mode) {
        setPendingFunction(data.function_results.function_call);
        setAwaitingConfirmation(true);
      } else if (data?.mode === 'commit') {
        setPendingFunction(null);
        setAwaitingConfirmation(false);
      }

      loadSessions();
      return data as AIChatResponse;

    } catch (err: any) {
      console.error('Chat error:', err, JSON.stringify(err, null, 2));
      console.error('Chat error details:', err?.message, err?.code, err?.details, err?.hint);
      toast({
        title: 'خطأ في المحادثة',
        description: `${err?.message || 'فشل الاتصال بجود AI. يرجى المحاولة مجدداً.'}`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [session, loading, currentSessionId, messages, createSession, loadSessions, toast]);

  // ── Tear down TTS analyser pipeline ───────────────────────────────────────
  const teardownTtsAnalyser = useCallback(() => {
    if (ttsRafRef.current) cancelAnimationFrame(ttsRafRef.current);
    ttsRafRef.current = null;
    ttsAudioCtxRef.current?.close().catch(() => {});
    ttsAudioCtxRef.current = null;
    ttsAudioElRef.current = null;
    setSpeakingIntensity(0);
  }, []);

  // ── ElevenLabs TTS — routes audio through Web Audio API + AnalyserNode ───
  // so MajlisMode's avatar can lip-sync to real TTS amplitude in real time.
  const speakMessage = useCallback(async (
    text: string,
    emotion: string = 'neutral',
    voiceMode: boolean = false,
  ) => {
    if (!session || !text) return;
    teardownTtsAnalyser();
    setSpeaking(true);
    try {
      // Direct fetch for speed \u2014 supabase.functions.invoke buffers the whole response
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://neadnclykbukvmlquepg.supabase.co';
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const ttsUrl = `${supabaseUrl}/functions/v1/elevenlabs-tts`;

      // 20s timeout \u2014 don't hang forever on slow TTS
      const ttsController = new AbortController();
      const ttsTimer = setTimeout(() => ttsController.abort(), 20000);

      const res = await fetch(ttsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          ...(anonKey ? { 'apikey': anonKey } : {}),
        },
        body: JSON.stringify({
          text,
          emotion,
          voice_mode: voiceMode,
          language: /[\u0600-\u06FF]/.test(text) ? 'ar' : 'en',
        }),
        signal: ttsController.signal,
      });
      clearTimeout(ttsTimer);

      if (!res.ok) throw new Error(`TTS error: ${res.status}`);

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      ttsAudioElRef.current = audio;

      const cleanup = () => {
        setSpeaking(false);
        teardownTtsAnalyser();
        URL.revokeObjectURL(url);
      };
      audio.onended = cleanup;
      audio.onerror = cleanup;

      // ── Web Audio analyser tap for lip-sync amplitude ───────────────────
      try {
        const ctx = new AudioContext();
        ttsAudioCtxRef.current = ctx;
        const source = ctx.createMediaElementSource(audio);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
        analyser.connect(ctx.destination); // keep playing through speakers

        const buf = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteFrequencyData(buf);
          const avg = buf.reduce((s, v) => s + v, 0) / buf.length / 255;
          setSpeakingIntensity(avg);
          ttsRafRef.current = requestAnimationFrame(tick);
        };
        tick();
      } catch (audioErr) {
        // Some browsers reject createMediaElementSource — TTS still plays,
        // avatar falls back to scripted animation.
        console.warn('[TTS analyser] disabled:', audioErr);
      }

      await audio.play();
    } catch (err) {
      console.error('[elevenlabs-tts] error:', err);
      setSpeaking(false);
      teardownTtsAnalyser();
    }
  }, [session, teardownTtsAnalyser]);

  // ── Stop in-flight TTS — used by Majlis Mode to support interruption ─────
  const stopSpeaking = useCallback(() => {
    const audio = ttsAudioElRef.current;
    if (audio) {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch { /* ignore */ }
    }
    setSpeaking(false);
    teardownTtsAnalyser();
  }, [teardownTtsAnalyser]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const startNewChat = useCallback(() => {
    setCurrentSessionId(null);
    setMessages([]);
    setPendingFunction(null);
    setAwaitingConfirmation(false);
  }, []);

  const deleteSession = useCallback(async (sessionId: string) => {
    if (!session?.user?.id) return;
    try {
      // Delete all messages first
      await (supabase as any)
        .from('chat_messages')
        .delete()
        .eq('session_id', sessionId);
      // Delete the session
      await (supabase as any)
        .from('chat_sessions')
        .delete()
        .eq('id', sessionId)
        .eq('user_id', session.user.id);
      // If we deleted the active session, clear it
      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);
        setMessages([]);
        setPendingFunction(null);
        setAwaitingConfirmation(false);
      }
      await loadSessions();
    } catch (err) {
      console.error('Error deleting session:', err);
    }
  }, [session?.user?.id, currentSessionId, loadSessions]);

  const confirmAction = useCallback(async (action: 'yes' | 'no' | 'edit') => {
    if (action === 'yes') {
      await sendMessage('yes', { mode: 'commit', pendingFunction });
    } else if (action === 'no') {
      setPendingFunction(null);
      setAwaitingConfirmation(false);
      await sendMessage('لا، شكراً');
    } else {
      setAwaitingConfirmation(false);
    }
  }, [pendingFunction, sendMessage]);

  return {
    sessions,
    messages,
    currentSessionId,
    loading,
    sessionsLoading,
    speaking,
    speakingIntensity,
    awaitingConfirmation,
    loadSessions,
    loadMessages,
    startNewChat,
    deleteSession,
    sendMessage,
    speakMessage,
    stopSpeaking,
    confirmAction,
  };
};
