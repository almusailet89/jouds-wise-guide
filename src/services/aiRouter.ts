/**
 * src/services/aiRouter.ts
 *
 * The dispatch point between OpenAI and Claude chat backends. Public API is
 * `chatService.sendMessage(req, token)` — same signature as either branch in
 * isolation. Routing is purely env-driven and runtime-replaceable (so flipping
 * the flag in `.env.local` without rebuilding still works in dev).
 *
 * The router is INERT when VITE_PRIMARY_MODEL is unset or equals "openai" —
 * it returns the existing OpenAI service object. With "claude" it returns the
 * new Claude service. Nothing else changes.
 */

import { FLAGS, type ChatProvider } from '@/config/models';
import { openaiChatService } from './openai';
import { claudeChatService } from './claude';
import type { ChatService } from './openai';
import type { ChatRequest, LegacyAiChatResponse } from './types';

/** Return the active chat service based on current flags. Cheap; safe to call
 *  per-request. */
export function getChatService(override?: ChatProvider): ChatService {
  const provider = override ?? FLAGS.primaryModel;
  if (provider === 'claude') return claudeChatService;
  return openaiChatService;
}

/**
 * Single-call wrapper for callers who don't want to manage the service object.
 *
 *   const reply = await sendChatMessage({ message: '...' }, token);
 *
 * Falls back to OpenAI on Claude failure UNLESS the caller passes
 * `noFallback: true`. This is the only place where "automatic failover"
 * happens; both individual services throw on errors as before.
 */
export async function sendChatMessage(
  req:          ChatRequest,
  accessToken:  string,
  opts?:        { noFallback?: boolean; provider?: ChatProvider },
): Promise<LegacyAiChatResponse> {
  const primary = getChatService(opts?.provider);
  try {
    return await primary.sendMessage(req, accessToken);
  } catch (err) {
    if (primary === openaiChatService || opts?.noFallback) throw err;
    // Claude path failed and fallback isn't disabled → try OpenAI.
    // We swallow the original error after logging so the chat UX stays alive.
    console.warn('[aiRouter] Claude path failed, falling back to OpenAI:', (err as Error).message);
    return await openaiChatService.sendMessage(req, accessToken);
  }
}

/** Re-export the type so consumers can import everything from one path. */
export type { ChatService };
