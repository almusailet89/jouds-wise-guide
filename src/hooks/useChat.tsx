import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

export interface ChatSession {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count?: number;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  pending?: boolean;
}

export const useChat = () => {
  const { session } = useAuth();
  const { toast } = useToast();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [pendingFunction, setPendingFunction] = useState<any>(null);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  const loadSessions = useCallback(async () => {
    if (!session?.user?.id) return;
    setSessionsLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('chat_sessions')
        .select('id, title, created_at, updated_at')
        .eq('user_id', session.user.id)
        .order('updated_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setSessions(data || []);
    } catch (err) {
      console.error('Error loading sessions:', err);
    } finally {
      setSessionsLoading(false);
    }
  }, [session?.user?.id]);

  const createSession = useCallback(async (firstMessage?: string): Promise<string> => {
    if (!session?.user?.id) throw new Error('Not authenticated');

    const title = firstMessage
      ? firstMessage.slice(0, 60) + (firstMessage.length > 60 ? '…' : '')
      : 'New Conversation';

    const { data, error } = await (supabase as any)
      .from('chat_sessions')
      .insert({ user_id: session.user.id, title })
      .select('id')
      .single();

    if (error) throw error;
    const newId = data.id;
    setCurrentSessionId(newId);
    await loadSessions();
    return newId;
  }, [session?.user?.id, loadSessions]);

  const loadMessages = useCallback(async (sessionId: string) => {
    setCurrentSessionId(sessionId);
    setMessages([]);
    setPendingFunction(null);
    setAwaitingConfirmation(false);

    const { data, error } = await (supabase as any)
      .from('chat_messages')
      .select('id, session_id, role, content, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading messages:', error);
      return;
    }
    setMessages(data || []);
  }, []);

  const saveMessage = async (sessionId: string, role: 'user' | 'assistant', content: string): Promise<string> => {
    const { data, error } = await (supabase as any)
      .from('chat_messages')
      .insert({ session_id: sessionId, role, content })
      .select('id')
      .single();

    if (error) throw error;

    // Bump session updated_at
    await (supabase as any)
      .from('chat_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', sessionId);

    return data.id;
  };

  const sendMessage = useCallback(async (
    text: string,
    mode?: string,
    existingPendingFunction?: any,
  ) => {
    if (!session || loading) return;
    const messageText = text.trim();
    if (!messageText) return;

    setLoading(true);

    try {
      // Ensure we have a session
      let sessionId = currentSessionId;
      if (!sessionId) {
        sessionId = await createSession(messageText);
      }

      // Add user message optimistically
      const userTempId = `temp-user-${Date.now()}`;
      setMessages(prev => [...prev, {
        id: userTempId,
        session_id: sessionId!,
        role: 'user',
        content: messageText,
        created_at: new Date().toISOString(),
      }]);

      // Save user message to DB
      await saveMessage(sessionId!, 'user', messageText);

      // Build context from current messages (last 20)
      const contextMessages = messages
        .slice(-20)
        .map(m => ({ role: m.role, content: m.content }));

      // Call ai-chat edge function
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          message: messageText,
          context: contextMessages,
          session_id: sessionId,
          mode,
          pendingFunction: existingPendingFunction,
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;

      const aiText: string = data?.message || 'مرحباً، أنا جود. كيف يمكنني مساعدتك؟';

      // Save AI message
      const aiId = await saveMessage(sessionId!, 'assistant', aiText);

      // Replace temp user message with real and add AI message
      setMessages(prev => [
        ...prev.filter(m => m.id !== userTempId),
        {
          id: `user-${Date.now()}`,
          session_id: sessionId!,
          role: 'user',
          content: messageText,
          created_at: new Date().toISOString(),
        },
        {
          id: aiId,
          session_id: sessionId!,
          role: 'assistant',
          content: aiText,
          created_at: new Date().toISOString(),
        },
      ]);

      // Handle function preview mode
      if (data?.function_results?.preview_mode) {
        setPendingFunction(data.function_results.function_call);
        setAwaitingConfirmation(true);
      } else if (data?.mode === 'commit') {
        setPendingFunction(null);
        setAwaitingConfirmation(false);
      }

      // Refresh session list (updated_at changed)
      loadSessions();

      return data;
    } catch (err: any) {
      console.error('Chat error:', err);
      toast({
        title: 'خطأ في المحادثة',
        description: 'فشل الاتصال بجود AI. يرجى المحاولة مجدداً.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [session, loading, currentSessionId, messages, createSession, loadSessions, toast]);

  const speakMessage = useCallback(async (text: string) => {
    if (!session) return;
    setSpeaking(true);
    try {
      const { data, error } = await supabase.functions.invoke('ameera-tts', {
        body: { text, emotion: 'warm', language: text.match(/[\u0600-\u06FF]/) ? 'ar' : 'en' },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;

      // data is raw ArrayBuffer audio
      const blob = new Blob([data], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => { setSpeaking(false); URL.revokeObjectURL(url); };
      audio.onerror = () => { setSpeaking(false); URL.revokeObjectURL(url); };
      audio.play();
    } catch (err) {
      console.error('TTS error:', err);
      setSpeaking(false);
    }
  }, [session]);

  const startNewChat = useCallback(() => {
    setCurrentSessionId(null);
    setMessages([]);
    setPendingFunction(null);
    setAwaitingConfirmation(false);
  }, []);

  const confirmAction = useCallback(async (action: 'yes' | 'no' | 'edit') => {
    if (action === 'yes') {
      await sendMessage('yes', 'commit', pendingFunction);
    } else if (action === 'no') {
      setPendingFunction(null);
      setAwaitingConfirmation(false);
      await sendMessage('لا، شكراً');
    } else {
      setAwaitingConfirmation(false);
    }
  }, [pendingFunction, sendMessage]);

  return {
    sessions,
    messages,
    currentSessionId,
    loading,
    sessionsLoading,
    speaking,
    awaitingConfirmation,
    loadSessions,
    loadMessages,
    startNewChat,
    sendMessage,
    speakMessage,
    confirmAction,
  };
};
