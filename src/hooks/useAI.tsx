import { useState } from 'react';
import { useAuth } from './useAuth';
import { supabase, SUPABASE_URL } from '@/integrations/supabase/client';
import { useToast } from './use-toast';
import { SYSTEM_PROMPT } from '@/ai/JoodIdentity';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export type ChatMode = 'structured' | 'infinite' | 'commit';

export const useAI = () => {
  const { session } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  // TODO: re-enable when remote egress is acceptable
  const OFFLINE = import.meta.env?.VITE_DEV_OFFLINE === '1';
  const ENV_SAVER = import.meta.env?.VITE_EGRESS_SAVER === '1';
  const EGRESS_SAVER = OFFLINE || ENV_SAVER || (typeof window !== 'undefined' && window.localStorage.getItem('egressSaver') === '1');

  const sendMessage = async (message: string, context?: ChatMessage[], mode: ChatMode = 'structured', pendingFunction?: any): Promise<any> => {
    if (!session) {
      throw new Error('User must be logged in to chat');
    }

    try {
      setLoading(true);
      // Do not gate chat in saver mode; only offline disables it
      if (OFFLINE) {
        return { message: 'Mock reply (offline mode)', mode, preview_mode: false, mock: true };
      }
      
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: { 
          message,
          context: [
            { role: 'system', content: SYSTEM_PROMPT.content },
            ...(context?.map(msg => ({ role: msg.role, content: msg.content })) || []),
          ],
          mode,
          pendingFunction
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('AI chat error:', error);
        throw new Error('Failed to get AI response');
      }

      return data;
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "AI Chat Error",
        description: "Failed to get response from Joud AI. Please try again.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Streaming chat for Infinite mode using SSE
  const sendMessageStream = async (
    message: string,
    context?: ChatMessage[],
    onToken?: (token: string) => void,
  ): Promise<string> => {
    setLoading(true);
    let finalText = '';
    try {
      // Do not gate chat in saver mode; only offline disables it
      if (OFFLINE) {
        finalText = 'Mock reply (offline mode)';
        onToken?.(finalText);
        return finalText;
      }
      const { data: sess } = await supabase.auth.getSession();
      const accessToken = sess.session?.access_token;
      if (!accessToken) throw new Error('No active session');

      const AI_CHAT_URL = `${SUPABASE_URL}/functions/v1/ai-chat`;
      const res = await fetch(AI_CHAT_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({
          message,
          context: [
            { role: 'system', content: SYSTEM_PROMPT.content },
            ...(context?.map(msg => ({ role: msg.role, content: msg.content })) ?? []),
          ],
          mode: 'infinite',
        }),
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => '');
        throw new Error(text || 'Failed to start streaming response');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          if (trimmed.startsWith('data: ')) {
            const jsonStr = trimmed.slice(6);
            if (jsonStr === '[DONE]') {
              await reader.cancel().catch(() => {});
              break;
            }
            try {
              const payload = JSON.parse(jsonStr);
              const delta = payload.choices?.[0]?.delta?.content;
              if (typeof delta === 'string' && delta.length > 0) {
                finalText += delta;
                onToken?.(delta);
              }
            } catch {
              // ignore non-JSON event lines
            }
          }
        }
      }

      return finalText;
    } catch (error) {
      console.error('Error streaming message:', error);
      toast({
        title: 'Streaming Error',
        description: 'Failed to stream response from Joud AI.',
        variant: 'destructive',
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const textToSpeech = async (text: string, voice: string = 'nova'): Promise<string> => {
    try {
      setSpeaking(true);
      // TODO: re-enable when remote egress is acceptable
      if (EGRESS_SAVER) {
        return '';
      }
      
      const { data, error } = await supabase.functions.invoke('text-to-speech', {
        body: { text, voice },
      });

      if (error) {
        console.error('TTS error:', error);
        throw new Error('Failed to generate speech');
      }

      return data.audioContent; // Base64 encoded audio
    } catch (error) {
      console.error('Error generating speech:', error);
      toast({
        title: "Speech Generation Error",
        description: "Failed to generate speech. Please try again.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setSpeaking(false);
    }
  };

  const playAudio = (base64Audio: string) => {
    try {
      const audio = new Audio(`data:audio/mp3;base64,${base64Audio}`);
      audio.play();
      
      audio.onended = () => {
        setSpeaking(false);
      };
      
      audio.onerror = () => {
        setSpeaking(false);
        toast({
          title: "Audio Playback Error",
          description: "Failed to play audio.",
          variant: "destructive",
        });
      };
    } catch (error) {
      console.error('Error playing audio:', error);
      setSpeaking(false);
    }
  };

  const speakMessage = async (text: string, voice: string = 'nova') => {
    try {
      // TODO: re-enable when remote egress is acceptable
      if (EGRESS_SAVER) return;
      const audioContent = await textToSpeech(text, voice);
      playAudio(audioContent);
    } catch (error) {
      console.error('Error speaking message:', error);
    }
  };

  return {
    sendMessage,
    sendMessageStream,
    textToSpeech,
    playAudio,
    speakMessage,
    loading,
    speaking,
  };
};