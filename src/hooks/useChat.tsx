import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { useLanguage } from './useLanguage';

// ─── Arabic + English sentence splitter for voice TTS pipeline ───────────────
// Splits text into natural spoken units, groups short fragments, strips markdown.
// Each chunk is ≤250 chars so ElevenLabs returns audio quickly (≤10s per chunk).
function splitIntoVoiceSentences(text: string): string[] {
  if (!text?.trim()) return [];

  // 1. Strip markdown artifacts
  const clean = text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g,   '$1')
    .replace(/`([^`]+)`/g,     '$1')
    .replace(/#{1,6}\s+/gm,    '')
    .replace(/^[-•–*]\s+/gm,   '')
    .replace(/^\d+\.\s+/gm,    '')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .trim();

  if (clean.length <= 180) return [clean]; // Short enough — send as one chunk

  // 2. Split at hard sentence endings: . ! ? ؟
  const rawParts = clean
    .split(/(?<=[.!?؟])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  // 3. Merge very short fragments (<40 chars) with the next sentence
  const merged: string[] = [];
  let buf = '';
  for (const part of rawParts) {
    const candidate = buf ? `${buf} ${part}` : part;
    if (candidate.length > 250 && buf) {
      merged.push(buf);
      buf = part;
    } else {
      buf = candidate;
    }
    // Flush at Arabic comma pause if buffer is long enough
    if (buf.length > 130 && /[،,]$/.test(buf)) {
      merged.push(buf);
      buf = '';
    }
  }
  if (buf.trim()) merged.push(buf.trim());

  return merged.filter(s => s.length >= 2);
}

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

  // ── Refs for TTS audio pipeline (sentence-level streaming + lip-sync) ───────
  const ttsAudioCtxRef  = useRef<AudioContext | null>(null);
  const ttsAudioElRef   = useRef<HTMLAudioElement | null>(null); // fallback only
  const ttsRafRef       = useRef<number | null>(null);
  const ttsAbortRef     = useRef<AbortController | null>(null); // abort in-flight fetches

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

  // ── Tear down TTS pipeline ─────────────────────────────────────────────────
  const teardownTtsAnalyser = useCallback(() => {
    if (ttsRafRef.current)  { cancelAnimationFrame(ttsRafRef.current); ttsRafRef.current = null; }
    ttsAudioCtxRef.current?.close().catch(() => {});
    ttsAudioCtxRef.current = null;
    if (ttsAudioElRef.current) {
      try { ttsAudioElRef.current.pause(); } catch { /* ignore */ }
      ttsAudioElRef.current = null;
    }
    setSpeakingIntensity(0);
  }, []);

  // ── ElevenLabs TTS — sentence-level streaming pipeline ──────────────────
  //
  // Architecture:
  //   1. Split text into natural spoken sentences (Arabic + English aware)
  //   2. Pre-fetch TTS for sentence[0] + sentence[1] in parallel immediately
  //   3. Decode sentence[0] → schedule on WebAudio timeline at t+0.05s
  //   4. While sentence[0] plays, sentence[1] is already decoded and ready
  //   5. Schedule sentence[1] at exact end of sentence[0] — zero gap
  //   6. Rolling lookahead: always 2 sentences pre-fetched
  //
  // Result: first audio plays ~1s after call (vs 3-5s with full-blob approach)
  // Lip-sync: analyser node measures TTS amplitude in real time → avatar moves
  //
  const speakMessage = useCallback(async (
    text: string,
    emotion: string = 'neutral',
    voiceMode: boolean = false,
  ) => {
    if (!session || !text?.trim()) return;

    teardownTtsAnalyser();
    setSpeaking(true);

    const abort = new AbortController();
    ttsAbortRef.current = abort;

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://neadnclykbukvmlquepg.supabase.co';
    const anonKey     = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const ttsUrl      = `${supabaseUrl}/functions/v1/elevenlabs-tts`;
    const lang        = /[\u0600-\u06FF]/.test(text) ? 'ar' : 'en';

    const sentences = splitIntoVoiceSentences(text.trim());
    if (!sentences.length) { setSpeaking(false); return; }

    // ── WebAudio setup ────────────────────────────────────────────────────────
    let ctx: AudioContext;
    try { ctx = new AudioContext(); }
    catch {
      // WebAudio unavailable — HTMLAudioElement fallback (full-blob, no gapless)
      try {
        const res = await fetch(ttsUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}`, ...(anonKey ? { apikey: anonKey } : {}) },
          body: JSON.stringify({ text, emotion, voice_mode: voiceMode, language: lang }),
          signal: abort.signal,
        });
        if (res.ok && !abort.signal.aborted) {
          const blobUrl = URL.createObjectURL(await res.blob());
          const audio = new Audio(blobUrl);
          ttsAudioElRef.current = audio;
          audio.onended = audio.onerror = () => { setSpeaking(false); teardownTtsAnalyser(); URL.revokeObjectURL(blobUrl); };
          await audio.play();
        }
      } catch { /* ignore */ }
      setSpeaking(false);
      return;
    }
    ttsAudioCtxRef.current = ctx;

    // Analyser drives lip-sync intensity (0..1) through rAF
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 128;
    analyser.connect(ctx.destination);
    const analyserBuf = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      if (!ttsAudioCtxRef.current) return;
      analyser.getByteFrequencyData(analyserBuf);
      const avg = analyserBuf.reduce((s, v) => s + v, 0) / analyserBuf.length / 255;
      setSpeakingIntensity(avg);
      ttsRafRef.current = requestAnimationFrame(tick);
    };
    tick();

    // ── Per-sentence fetch → AudioBuffer ──────────────────────────────────────
    const fetchSentence = async (s: string): Promise<AudioBuffer | null> => {
      if (abort.signal.aborted) return null;
      try {
        const res = await fetch(ttsUrl, {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            ...(anonKey ? { apikey: anonKey } : {}),
          },
          body: JSON.stringify({ text: s, emotion, voice_mode: voiceMode, language: lang }),
          signal: abort.signal,
        });
        if (!res.ok || abort.signal.aborted) return null;
        const arr = await res.arrayBuffer();
        if (abort.signal.aborted) return null;
        return await ctx.decodeAudioData(arr.slice(0));
      } catch {
        return null;
      }
    };

    // Lookahead prefetch: index → Promise<AudioBuffer|null>
    const prefetched = new Map<number, Promise<AudioBuffer | null>>();
    const prefetch = (i: number) => {
      if (i < sentences.length && !prefetched.has(i)) {
        prefetched.set(i, fetchSentence(sentences[i]));
      }
    };
    prefetch(0);
    prefetch(1); // both kick off in parallel immediately

    // ── Gapless WebAudio scheduler ────────────────────────────────────────────
    let nextStartAt = ctx.currentTime + 0.05;

    for (let i = 0; i < sentences.length; i++) {
      if (abort.signal.aborted) break;

      prefetch(i + 2); // rolling 2-sentence lookahead

      const buffer = await prefetched.get(i);
      if (!buffer || abort.signal.aborted) continue;

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(analyser); // audio → analyser → destination (speakers)

      const startAt = Math.max(ctx.currentTime + 0.01, nextStartAt);
      source.start(startAt);
      nextStartAt = startAt + buffer.duration;

      // Sleep until 150ms before this sentence ends, then schedule next immediately
      const waitMs = Math.max(0, (nextStartAt - ctx.currentTime - 0.15) * 1000);
      if (waitMs > 10) {
        await new Promise<void>(resolve => {
          const t = setTimeout(resolve, waitMs);
          abort.signal.addEventListener('abort', () => { clearTimeout(t); resolve(); }, { once: true });
        });
      }
    }

    // Wait for the last sentence to fully finish
    if (!abort.signal.aborted) {
      const remaining = Math.max(0, (nextStartAt - ctx.currentTime) * 1000 + 300);
      if (remaining > 0) {
        await new Promise<void>(resolve => {
          const t = setTimeout(resolve, remaining);
          abort.signal.addEventListener('abort', () => { clearTimeout(t); resolve(); }, { once: true });
        });
      }
    }

    if (!abort.signal.aborted) setSpeaking(false);
    teardownTtsAnalyser();
  }, [session, teardownTtsAnalyser]); // eslint-disable-line

  // ── Stop TTS immediately — barge-in / user interrupt ─────────────────────
  const stopSpeaking = useCallback(() => {
    ttsAbortRef.current?.abort();
    ttsAbortRef.current = null;
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
