/**
 * src/services/openai.ts
 *
 * Thin wrapper around the existing `ai-chat` Supabase edge function. Extracted
 * here so the new `aiRouter` can dispatch to a uniform `ChatService` interface
 * without changing `useAI.tsx`.
 *
 * This file is ADDITIVE — `useAI.tsx` continues to call `supabase.functions
 * .invoke('ai-chat', ...)` directly. Callers can migrate to this wrapper over
 * time. Until they do, behavior is identical.
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  ChatRequest,
  LegacyAiChatResponse,
  LegacyAiChatErrorResponse,
} from './types';

export interface ChatService {
  sendMessage(req: ChatRequest, accessToken: string): Promise<LegacyAiChatResponse>;
  readonly providerLabel: string;
}

class OpenAIChatService implements ChatService {
  readonly providerLabel = 'OpenAI';

  async sendMessage(req: ChatRequest, accessToken: string): Promise<LegacyAiChatResponse> {
    const { data, error } = await supabase.functions.invoke('ai-chat', {
      body: {
        message:            req.message,
        context:            req.context,
        session_id:         req.session_id,
        mode:               req.mode,
        pendingFunction:    req.pendingFunction,
        voice_mode:         req.voice_mode,
        detected_language:  req.detected_language,
        lang:               req.lang,
      },
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (error) {
      // Surface a plain Error so callers' existing try/catch keeps working.
      throw new Error((error as { message?: string }).message ?? 'ai-chat invoke failed');
    }
    if ((data as LegacyAiChatErrorResponse)?.error) {
      throw new Error((data as LegacyAiChatErrorResponse).error);
    }
    return data as LegacyAiChatResponse;
  }
}

export const openaiChatService: ChatService = new OpenAIChatService();
