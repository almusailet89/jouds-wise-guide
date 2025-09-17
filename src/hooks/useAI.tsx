import { useState } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export const useAI = () => {
  const { session } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const sendMessage = async (message: string, context?: ChatMessage[]): Promise<string> => {
    if (!session) {
      throw new Error('User must be logged in to chat');
    }

    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: { 
          message,
          context: context?.map(msg => ({ role: msg.role, content: msg.content }))
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        console.error('AI chat error:', error);
        throw new Error('Failed to get AI response');
      }

      return data.message;
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

  const textToSpeech = async (text: string, voice: string = 'nova'): Promise<string> => {
    try {
      setSpeaking(true);
      
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
      const audioContent = await textToSpeech(text, voice);
      playAudio(audioContent);
    } catch (error) {
      console.error('Error speaking message:', error);
    }
  };

  return {
    sendMessage,
    textToSpeech,
    playAudio,
    speakMessage,
    loading,
    speaking,
  };
};