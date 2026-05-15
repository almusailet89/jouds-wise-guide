/**
 * src/hooks/useJoodChat.ts
 *
 * Drop-in replacement for `useAI.tsx` that routes through `aiRouter`. The
 * public signature is identical to `useAI()` — same returned shape, same
 * argument list on `sendMessage`. Consumers can swap imports without code
 * changes.
 *
 *   Before:  const { sendMessage, speakMessage, loading, speaking } = useAI();
 *   After:   const { sendMessage, speakMessage, loading, speaking } = useJoodChat();
 *
 * Internally:
 *   - `sendMessage` → aiRouter.sendChatMessage (provider chosen via env flag).
 *   - `speakMessage` → unchanged voiceCloning path (provider switch lives in
 *      the text-to-speech edge function, additive only).
 *
 * `useAI.tsx` is NOT modified. Both hooks can coexist.
 */

import { useState, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { DEMO_CONFIG, DEMO_MESSAGES } from '@/config/demo';
import { demoStorage } from '@/lib/demoData';
import { generateVoiceClone, playVoiceAudio } from '@/services/voiceCloning';
import { sendChatMessage } from '@/services/aiRouter';
import type { LegacyAiChatResponse } from '@/services/types';

// Re-export the message shape from useAI for binary compatibility.
export interface ChatMessage {
  id:        string;
  role:      'user' | 'assistant';
  content:   string;
  timestamp: string;
}

export const useJoodChat = () => {
  const { session } = useAuth();
  const { toast }   = useToast();
  const [loading, setLoading]   = useState(false);
  const [speaking, setSpeaking] = useState(false);

  // Mirror useAI's signature: (message, context?, mode?, pendingFunction?) → any
  const sendMessage = useCallback(async (
    message: string,
    context?: ChatMessage[],
    mode?: string,
    pendingFunction?: { name: string; arguments: string },
  ): Promise<LegacyAiChatResponse | unknown> => {
    if (!session) throw new Error('User must be logged in to chat');

    try {
      setLoading(true);

      // Demo mode — preserve byte-identical behavior with useAI.
      if (DEMO_CONFIG.enabled) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        let response = DEMO_MESSAGES.ai_fallback;
        const lower = message.toLowerCase();
        if (lower.includes('hello') || lower.includes('hi')) {
          response = "Hello! I'm Jood, your elegant financial assistant. I'm currently in demo mode!";
        } else if (lower.includes('portfolio')) {
          response = 'Your portfolio shows SAR 150,000 total value with 25% gains.';
        } else if (lower.includes('task')) {
          response = 'You have 2 pending tasks and 1 completed task.';
        }
        const conversation = demoStorage.get('conversations') || [];
        conversation.push({
          id:        Date.now().toString(),
          user:      message,
          assistant: response,
          timestamp: new Date().toISOString(),
        });
        demoStorage.set('conversations', conversation);
        return {
          message:          response,
          function_results: null,
          mode:             'conversation',
          timestamp:        new Date().toISOString(),
        };
      }

      // Real path — router picks OpenAI or Claude based on env.
      const data = await sendChatMessage({
        message,
        context: context?.map(msg => ({ role: msg.role, content: msg.content })),
        mode,
        pendingFunction,
      }, session.access_token);

      return data;
    } catch (error) {
      console.error('Error sending message:', error);
      if (DEMO_CONFIG.enabled) {
        return {
          message:          DEMO_MESSAGES.ai_fallback,
          function_results: null,
          mode:             'conversation',
          timestamp:        new Date().toISOString(),
        };
      }
      toast({
        title:       'AI Chat Error',
        description: 'Failed to get response from Jood AI. Please try again.',
        variant:     'destructive',
      });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [session, toast]);

  // Voice path — unchanged from useAI. Same error toast wording is preserved
  // exactly so callers see identical UX.
  const speakMessage = useCallback(async (text: string) => {
    try {
      setSpeaking(true);
      const result = await generateVoiceClone({
        text,
        voice: 'jood',
        emotion: 'warm',
      });
      playVoiceAudio(result.audioUrl, {
        onStart: () => setSpeaking(true),
        onEnd:   () => setSpeaking(false),
        onError: (error: unknown) => {
          console.error('Voice playback error:', error);
          setSpeaking(false);
          toast({
            title:       'Voice Error',
            description: 'Failed to play voice response.',
            variant:     'destructive',
          });
        },
      });
    } catch (error) {
      console.error('Error generating voice:', error);
      setSpeaking(false);
      toast({
        title:       'Voice Generation Error',
        description: 'Failed to generate voice. Please try again.',
        variant:     'destructive',
      });
    }
  }, [toast]);

  return {
    sendMessage,
    speakMessage,
    loading,
    speaking,
  };
};
