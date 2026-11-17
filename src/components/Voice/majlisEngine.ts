// Shared contract for Majlis voice engines (Gemini Live, ElevenLabs).

export type MajlisMode = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking';

export type CallIssue =
  | 'denied'
  | 'no-device'
  | 'busy'
  | 'unsupported'
  | 'insecure'
  | 'connection'
  | 'minutes'
  | 'not-configured';

export type EngineId = 'gemini' | 'elevenlabs';

export interface MajlisEngine {
  mode: MajlisMode;
  transcript: string;
  lastReply: string;
  isMuted: boolean;
  intensity: number;
  connected: boolean;
  issue: CallIssue | null;
  /** Seconds of voice left this month; null when unlimited or unknown. */
  secondsLeft: number | null;
  start: () => Promise<void>;
  end: () => Promise<void>;
  toggleMute: () => void;
}

export async function checkMicAvailability(): Promise<CallIssue | null> {
  if (!window.isSecureContext) return 'insecure';
  if (!navigator.mediaDevices?.getUserMedia) return 'unsupported';
  if (!window.AudioContext && !(window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext) return 'unsupported';
  try {
    const status = await navigator.permissions?.query({ name: 'microphone' as PermissionName });
    if (status?.state === 'denied') return 'denied';
  } catch {
    // Some browsers can't query microphone permission; getUserMedia will tell us.
  }
  return null;
}

export function issueFromMediaError(err: unknown): CallIssue {
  const name = (err as DOMException | undefined)?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'no-device';
  return 'busy';
}

/** Read the JSON error code from a supabase.functions.invoke error, if any. */
export async function functionErrorCode(error: unknown): Promise<{ status?: number; code?: string }> {
  const ctx = (error as { context?: Response } | null)?.context;
  if (!ctx || typeof ctx.json !== 'function') return {};
  try {
    const body = await ctx.clone().json();
    return { status: ctx.status, code: typeof body?.error === 'string' ? body.error : undefined };
  } catch {
    return { status: ctx.status };
  }
}
