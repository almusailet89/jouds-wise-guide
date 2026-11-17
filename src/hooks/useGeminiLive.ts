import { useCallback, useEffect, useRef, useState } from 'react';
import type { LiveServerMessage, Session } from '@google/genai';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { MicCapture, PcmPlayer } from '@/lib/liveAudio';
import {
  checkMicAvailability, functionErrorCode, issueFromMediaError,
  type CallIssue, type MajlisEngine, type MajlisMode,
} from '@/components/Voice/majlisEngine';

// ═══════════════════════════════════════════════════════════════════════════════
// Majlis on Gemini Live (native audio, speech-to-speech)
//
//   1. gemini-live-token (edge) checks voice minutes and mints a one-use token
//      locked to Jood's model, voice, persona and tools.
//   2. The browser opens a WebSocket straight to Gemini Live with that token.
//   3. Mic audio streams up as 16 kHz PCM; Jood's voice streams back at 24 kHz.
//   4. Tool calls (tasks, events, money, memory) go to gemini-live-tools with
//      the user's own JWT, and the result is sent back to the model.
//   5. Elapsed time is reported to voice_usage every 30 s and when the call ends.
// ═══════════════════════════════════════════════════════════════════════════════

interface TokenResponse {
  token: string;
  model: string;
  api_version: string;
  remaining_seconds: number | null;
  session_max_seconds: number;
}

const USAGE_FLUSH_MS = 30_000;

export function useGeminiLive(): MajlisEngine {
  const { session: authSession } = useAuth();
  const { lang } = useLanguage();

  const [mode, setMode] = useState<MajlisMode>('idle');
  const [transcript, setTranscript] = useState('');
  const [lastReply, setLastReply] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [intensity, setIntensity] = useState(0);
  const [connected, setConnected] = useState(false);
  const [issue, setIssue] = useState<CallIssue | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const liveRef = useRef<Session | null>(null);
  const micRef = useRef<MicCapture | null>(null);
  const playerRef = useRef<PcmPlayer | null>(null);
  const tokenRef = useRef<TokenResponse | null>(null);
  const handleRef = useRef<string | null>(null);
  const readyRef = useRef(false);
  const endingRef = useRef(false);
  const reconnectingRef = useRef(false);
  const meterRef = useRef<number | null>(null);
  const callStartRef = useRef(0);
  const lastFlushRef = useRef(0);
  const firstFlushRef = useRef(true);
  const userBufRef = useRef('');
  const replyBufRef = useRef('');
  const replyDoneRef = useRef(true);
  const connectRef = useRef<(resume: boolean) => Promise<void>>();

  // ── Usage reporting ────────────────────────────────────────────────────────
  const flushUsage = useCallback(async () => {
    if (!lastFlushRef.current) return;
    const now = Date.now();
    const seconds = Math.round((now - lastFlushRef.current) / 1000);
    if (seconds <= 0 && !firstFlushRef.current) return;
    lastFlushRef.current = now;
    const newSession = firstFlushRef.current;
    firstFlushRef.current = false;
    try {
      // record_voice_usage is not in the generated types yet.
      await (supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<unknown>)(
        'record_voice_usage', { p_seconds: seconds, p_engine: 'gemini', p_new_session: newSession },
      );
    } catch (err) {
      console.warn('[Majlis Live] usage report failed', err);
    }
  }, []);

  // ── Teardown ───────────────────────────────────────────────────────────────
  const teardown = useCallback(async (nextIssue: CallIssue | null = null) => {
    endingRef.current = true;
    if (meterRef.current) { clearInterval(meterRef.current); meterRef.current = null; }
    await flushUsage();
    lastFlushRef.current = 0;
    try { liveRef.current?.close(); } catch { /* already closed */ }
    liveRef.current = null;
    readyRef.current = false;
    await micRef.current?.stop();
    micRef.current = null;
    await playerRef.current?.close();
    playerRef.current = null;
    tokenRef.current = null;
    handleRef.current = null;
    setConnected(false);
    setIsMuted(false);
    setIntensity(0);
    setTranscript('');
    setMode('idle');
    if (nextIssue) setIssue(nextIssue);
  }, [flushUsage]);

  // ── Tool calls ─────────────────────────────────────────────────────────────
  const runTools = useCallback(async (calls: NonNullable<LiveServerMessage['toolCall']>['functionCalls']) => {
    if (!calls?.length) return;
    setMode('thinking');
    const functionResponses = await Promise.all(calls.map(async call => {
      try {
        const { data, error } = await supabase.functions.invoke<{ result?: unknown }>('gemini-live-tools', {
          body: { name: call.name, args: call.args ?? {} },
        });
        if (error) throw error;
        return { id: call.id, name: call.name, response: { result: data?.result ?? null } };
      } catch (err) {
        console.warn('[Majlis Live] tool failed', call.name, err);
        return { id: call.id, name: call.name, response: { error: 'The tool failed. Tell the user briefly and offer to try again.' } };
      }
    }));
    liveRef.current?.sendToolResponse({ functionResponses });
  }, []);

  // ── Server messages ────────────────────────────────────────────────────────
  const onMessage = useCallback((msg: LiveServerMessage) => {
    if (msg.setupComplete) {
      readyRef.current = true;
      reconnectingRef.current = false;
      setConnected(true);
      setMode(playerRef.current?.playing ? 'speaking' : 'listening');
      if (!callStartRef.current) {
        callStartRef.current = Date.now();
        lastFlushRef.current = Date.now();
        firstFlushRef.current = true;
        void flushUsage();
        // Let Jood open the call with a short greeting.
        liveRef.current?.sendRealtimeInput({
          text: lang === 'ar'
            ? '(بدأت المكالمة الحين. رحّبي فيني بجملة قصيرة دافئة واسأليني وش أقدر أساعدك فيه.)'
            : '(The call just started. Greet me in one short, warm sentence and ask how you can help.)',
        });
      }
      return;
    }

    if (msg.sessionResumptionUpdate?.resumable && msg.sessionResumptionUpdate.newHandle) {
      handleRef.current = msg.sessionResumptionUpdate.newHandle;
    }

    if (msg.goAway) {
      // The server will close this socket soon; move to a fresh one with the handle.
      if (handleRef.current && !reconnectingRef.current) void connectRef.current?.(true);
      return;
    }

    if (msg.toolCall?.functionCalls?.length) {
      void runTools(msg.toolCall.functionCalls);
      return;
    }

    const content = msg.serverContent;
    if (!content) return;

    if (content.interrupted) {
      playerRef.current?.flush();
      replyDoneRef.current = true;
      setMode('listening');
    }

    if (content.inputTranscription?.text) {
      userBufRef.current += content.inputTranscription.text;
      setTranscript(userBufRef.current.trim());
    }

    const parts = content.modelTurn?.parts ?? [];
    for (const part of parts) {
      const data = part.inlineData?.data;
      if (data && part.inlineData?.mimeType?.startsWith('audio/')) {
        playerRef.current?.enqueue(data);
        if (userBufRef.current) { userBufRef.current = ''; setTranscript(''); }
        setMode('speaking');
      }
    }

    if (content.outputTranscription?.text) {
      if (replyDoneRef.current) { replyBufRef.current = ''; replyDoneRef.current = false; }
      replyBufRef.current += content.outputTranscription.text;
      setLastReply(replyBufRef.current.trim());
    }

    if (content.turnComplete) {
      replyDoneRef.current = true;
      if (!playerRef.current?.playing) setMode('listening');
    }
  }, [flushUsage, lang, runTools]);

  // ── Connect (fresh or resumed) ─────────────────────────────────────────────
  const connect = useCallback(async (resume: boolean) => {
    const token = tokenRef.current;
    if (!token) return;
    const { GoogleGenAI, Modality } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: token.token, httpOptions: { apiVersion: token.api_version } });
    const previous = liveRef.current;
    reconnectingRef.current = resume;
    readyRef.current = false;

    const live = await ai.live.connect({
      model: token.model,
      config: {
        responseModalities: [Modality.AUDIO],
        sessionResumption: resume && handleRef.current ? { handle: handleRef.current } : {},
      },
      callbacks: {
        onmessage: onMessage,
        onerror: (e) => console.error('[Majlis Live] socket error', e),
        onclose: (e) => {
          if (liveRef.current !== live) return;            // an older socket we replaced
          if (endingRef.current) return;
          if (handleRef.current && !reconnectingRef.current) {
            void connectRef.current?.(true).catch(() => teardown('connection'));
            return;
          }
          console.warn('[Majlis Live] closed', e.code, e.reason);
          void teardown(e.code === 1000 ? null : 'connection');
        },
      },
    });
    liveRef.current = live;
    if (previous && previous !== live) {
      try { previous.close(); } catch { /* already closed */ }
    }
  }, [onMessage, teardown]);
  connectRef.current = connect;

  // ── Start a call ───────────────────────────────────────────────────────────
  const start = useCallback(async () => {
    if (!authSession || liveRef.current) return;
    setIssue(null);
    setLastReply('');
    setTranscript('');
    setMode('connecting');
    endingRef.current = false;
    callStartRef.current = 0;
    userBufRef.current = '';
    replyBufRef.current = '';
    replyDoneRef.current = true;

    const preflight = await checkMicAvailability();
    if (preflight) { setIssue(preflight); setMode('idle'); return; }

    // Audio contexts are created before any further await, while the tap still counts.
    const player = new PcmPlayer(24000);
    const mic = new MicCapture(chunk => {
      if (readyRef.current) liveRef.current?.sendRealtimeInput({ audio: { data: chunk, mimeType: 'audio/pcm;rate=16000' } });
    });
    playerRef.current = player;
    micRef.current = mic;
    player.onIdle = () => setMode(m => (m === 'speaking' ? 'listening' : m));
    void player.resume();

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      });
    } catch (err) {
      console.error('[Majlis Live] microphone error', err);
      await teardown(issueFromMediaError(err));
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke<TokenResponse>('gemini-live-token', { body: { lang } });
      if (error || !data?.token) {
        const { code } = await functionErrorCode(error);
        stream.getTracks().forEach(t => t.stop());
        await teardown(code === 'minutes_exhausted' ? 'minutes' : code === 'not_configured' ? 'not-configured' : 'connection');
        return;
      }
      tokenRef.current = data;
      setSecondsLeft(data.remaining_seconds);

      await mic.start(stream);
      await connect(false);

      meterRef.current = window.setInterval(() => {
        const micLevel = Math.min((micRef.current?.level ?? 0) * 2.2, 1);
        const outLevel = playerRef.current?.level() ?? 0;
        setIntensity(Math.max(micLevel, outLevel));

        if (!callStartRef.current) return;
        const now = Date.now();
        const elapsed = (now - callStartRef.current) / 1000;
        const remaining = tokenRef.current?.remaining_seconds;
        if (remaining != null) {
          const left = Math.max(Math.round(remaining - elapsed), 0);
          setSecondsLeft(left);
          if (left <= 0) { void teardown('minutes'); return; }
        }
        // The session token lasts 30 minutes; close cleanly just before it expires.
        if (elapsed >= (tokenRef.current?.session_max_seconds ?? 1800) - 15) { void teardown(null); return; }
        if (now - lastFlushRef.current >= USAGE_FLUSH_MS) void flushUsage();
      }, 90);
    } catch (err) {
      console.error('[Majlis Live] start error', err);
      stream.getTracks().forEach(t => t.stop());
      await teardown('connection');
    }
  }, [authSession, connect, flushUsage, lang, teardown]);

  const end = useCallback(async () => {
    await teardown(null);
  }, [teardown]);

  const toggleMute = useCallback(() => {
    const mic = micRef.current;
    if (!mic || !liveRef.current) return;
    const next = !mic.muted;
    mic.muted = next;
    if (next && readyRef.current) liveRef.current.sendRealtimeInput({ audioStreamEnd: true });
    setIsMuted(next);
  }, []);

  // Close everything if the screen goes away mid-call.
  useEffect(() => () => { void teardown(null); }, [teardown]);

  return { mode, transcript, lastReply, isMuted, intensity, connected, issue, secondsLeft, start, end, toggleMute };
}
