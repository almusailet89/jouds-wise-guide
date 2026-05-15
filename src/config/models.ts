/**
 * src/config/models.ts
 *
 * SINGLE SOURCE OF TRUTH for model IDs and routing rules.
 *
 * Edge functions read the same env-var names but live in their own runtime;
 * this file is for the FRONTEND. Keep the keys aligned with
 * supabase/functions/claude-chat/index.ts MODELS.
 */

export type ModelTier = 'haiku' | 'sonnet' | 'opus';
export type ChatProvider = 'openai' | 'claude';

/** Frontend-visible model IDs. Read from Vite env at build time, fall back to
 *  the same defaults the edge function uses. */
export const CLAUDE_MODELS: Record<ModelTier, string> = {
  haiku:  import.meta.env.VITE_CLAUDE_MODEL_HAIKU  ?? 'claude-haiku-4-5',
  sonnet: import.meta.env.VITE_CLAUDE_MODEL_SONNET ?? 'claude-sonnet-4-6',
  opus:   import.meta.env.VITE_CLAUDE_MODEL_OPUS   ?? 'claude-opus-4-6',
};

/** OpenAI model used by the legacy edge function — surfaced here for telemetry
 *  & UI labelling. Changing this DOES NOT change the edge function's behavior. */
export const OPENAI_MODEL = 'gpt-4o-mini';

/** Feature flags read from import.meta.env. Defaults match "off / openai". */
export const FLAGS = {
  primaryModel:      (import.meta.env.VITE_PRIMARY_MODEL      ?? 'openai') as ChatProvider,
  ttsProvider:       (import.meta.env.VITE_TTS_PROVIDER       ?? 'openai') as 'openai' | 'azure',
  enableSkills:      import.meta.env.VITE_ENABLE_SKILLS       === 'true',
  enableStreamingV2: import.meta.env.VITE_ENABLE_STREAMING_V2 === 'true',
};

/** Pick a Claude tier for a given message. Mirrored from claude-chat
 *  function's `pickModelTier()`, kept in sync intentionally — this lets the
 *  client display the model badge before the response returns. */
export function pickClaudeTier(message: string, voiceMode: boolean): ModelTier {
  if (voiceMode) return 'haiku';
  if (/zakat across|plan (my|the) (week|month|quarter)|portfolio.*(plan|forecast|rebalance|strategy)|deep.{0,20}analysis/i.test(message)) {
    return 'opus';
  }
  return 'sonnet';
}
