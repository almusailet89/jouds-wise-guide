/**
 * src/services/types.ts
 *
 * THE CONTRACT.
 *
 * `LegacyAiChatResponse` describes the response shape of the existing
 * `supabase/functions/ai-chat/index.ts` edge function as observed on `main`.
 * Anything that flows back to the chat UI MUST satisfy this shape — both the
 * existing OpenAI path and the new Claude path.
 *
 * Captured during pre-work snapshot 2026-05-15. Ground truth: live deployment
 * of `ai-chat` v50 inspected via `tests/integration/regression.spec.ts`.
 *
 * IMPORTANT — why so many fields are optional:
 *   The existing ai-chat function returns DIFFERENT subsets of fields
 *   depending on which code path produces the response:
 *     - normal/preview path → message, model_used, voice_mode, detected_language,
 *                             action_card, function_results, mode
 *     - commit path        → message, mode, action_card
 *     - cancel path        → message, mode, action_card
 *     - error path         → error (HTTP 500)
 *
 *   So only `message` is truly required in the happy-path union; everything else
 *   is marked optional to faithfully describe what `main` returns today.
 *   Per Prime Directive #4 (no refactor this session), we describe reality
 *   rather than normalize it.
 */

// ─── Sub-types ───────────────────────────────────────────────────────────────

/** An "action card" preview shown beneath an assistant message. */
export interface ActionCard {
  /** Discriminator — e.g. 'task', 'finance', 'event', 'goal', 'portfolio', 'holding_update'. */
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
  data:    Record<string, unknown>;
}

/** Function-call payload echoed when the model wants to perform an action. */
export interface FunctionResults {
  preview_mode?: boolean;
  function_call?: {
    name:      string;
    arguments: string; // JSON-encoded
  };
}

/** Conversation mode reported by the server. */
export type ChatMode =
  | 'conversation'
  | 'preview'
  | 'commit'
  | 'cancel'
  | 'error'
  | (string & {});

/** Detected language tag. */
export type DetectedLanguage = 'ar' | 'en' | 'mixed';

// ─── The legacy contract ─────────────────────────────────────────────────────

/**
 * The frozen response shape that BOTH the existing OpenAI edge function and
 * the new Claude edge function must satisfy. Any new field added by Claude
 * (e.g. `tokens_used`, `skill_id`) must go into LegacyAiChatResponseExtended
 * below — NOT here.
 */
export interface LegacyAiChatResponse {
  /** Assistant message text. The only field present on every success path. */
  message: string;

  /** Which model generated this — e.g. 'gpt-4o-mini'. Present on the normal path. */
  model_used?: string;

  /** Was the request issued in voice mode? */
  voice_mode?: boolean;

  /** Language the model detected from the user's message. */
  detected_language?: DetectedLanguage;

  /** Optional preview card to render under the assistant message. */
  action_card?: ActionCard | null;

  /** Function-call envelope (preview / commit). */
  function_results?: FunctionResults | null;

  /** Conversation mode. */
  mode?: ChatMode;
}

/** HTTP 500 error envelope returned on failure. */
export interface LegacyAiChatErrorResponse {
  error: string;
}

/** Discriminated union of the two server responses. */
export type LegacyAiChatResult =
  | LegacyAiChatResponse
  | LegacyAiChatErrorResponse;

// ─── Claude superset (additive only) ─────────────────────────────────────────

/**
 * Extended response that the new claude-chat function MAY return on top of
 * LegacyAiChatResponse. Every added field is optional so callers built
 * against the legacy contract continue to work.
 */
export interface ClaudeChatResponse extends LegacyAiChatResponse {
  /** Specific Claude model used — e.g. 'claude-haiku-4-5' / 'claude-sonnet-4-6'. */
  model?: string;

  /** Skill that was activated (if VITE_ENABLE_SKILLS=true). */
  skill_id?: string;

  /** Token usage for cost tracking. */
  tokens_used?: {
    input:  number;
    output: number;
  };

  /** Set true when the server streamed chunks instead of returning whole JSON. */
  streamed?: boolean;
}

// ─── Request type (input side) ───────────────────────────────────────────────

/** Request body accepted by ai-chat. New fields the Claude path may use are
 *  declared optional so existing callers stay valid. */
export interface ChatRequest {
  message:            string;
  context?:           { role: 'user' | 'assistant'; content: string }[];
  session_id?:        string;
  mode?:              string;
  pendingFunction?:   { name: string; arguments: string };
  voice_mode?:        boolean;
  detected_language?: DetectedLanguage;
  lang?:              'ar' | 'en';

  // ─── Claude-path only (optional, ignored by ai-chat) ──────────────────────
  /** Request streaming chunks instead of one JSON response. */
  stream?:            boolean;
  /** Force a specific model tier — bypasses default routing. */
  model_tier?:        'haiku' | 'sonnet' | 'opus';
  /** Opt into skills (also requires VITE_ENABLE_SKILLS=true server-side). */
  enable_skills?:     boolean;
}
