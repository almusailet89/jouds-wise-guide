/**
 * src/services/claude.ts
 *
 * Mirror of `openai.ts` — same `ChatService` interface, dispatches to the new
 * `claude-chat` Supabase edge function. The router (`aiRouter.ts`) picks
 * between the two based on `VITE_PRIMARY_MODEL`.
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  ChatRequest,
  LegacyAiChatResponse,
  LegacyAiChatErrorResponse,
  ClaudeChatResponse,
} from './types';
import type { ChatService } from './openai';
import { FLAGS, pickClaudeTier, CLAUDE_MODELS } from '@/config/models';

class ClaudeChatService implements ChatService {
  readonly providerLabel = 'Claude';

  async sendMessage(req: ChatRequest, accessToken: string): Promise<LegacyAiChatResponse> {
    const tier = req.model_tier ?? pickClaudeTier(req.message, req.voice_mode ?? false);

    const { data, error } = await supabase.functions.invoke('claude-chat', {
      body: {
        // ── Legacy fields (unchanged) ──
        message:            req.message,
        context:            req.context,
        session_id:         req.session_id,
        mode:               req.mode,
        pendingFunction:    req.pendingFunction,
        voice_mode:         req.voice_mode,
        detected_language:  req.detected_language,
        lang:               req.lang,
        // ── Claude-only fields ──
        stream:             req.stream ?? false,
        model_tier:         tier,
        enable_skills:      req.enable_skills ?? FLAGS.enableSkills,
      },
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (error) {
      throw new Error((error as { message?: string }).message ?? 'claude-chat invoke failed');
    }
    if ((data as LegacyAiChatErrorResponse)?.error) {
      throw new Error((data as LegacyAiChatErrorResponse).error);
    }

    // The server returns a LegacyAiChatResponse-shaped body (with optional
    // ClaudeChatResponse extensions). Return as the wider type's superset.
    return data as ClaudeChatResponse;
  }
}

export const claudeChatService: ChatService = new ClaudeChatService();

/** Exported model badge — `useJoodChat` may surface it for telemetry, not UI. */
export const CLAUDE_MODEL_BADGE = CLAUDE_MODELS;
