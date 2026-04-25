import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type MemoryKind =
  | 'fact'
  | 'preference'
  | 'goal'
  | 'pattern'
  | 'relationship'
  | 'context';

export interface UserMemory {
  id: string;
  user_id: string;
  kind: MemoryKind;
  content: string;
  metadata: Record<string, any>;
  confidence: number;
  importance: number;
  active: boolean;
  use_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export const useMemories = () => {
  const { session } = useAuth();
  const [memories, setMemories] = useState<UserMemory[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!session?.user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('user_memories')
        .select('*')
        .eq('user_id', session.user.id)
        .order('importance', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMemories((data ?? []) as UserMemory[]);
    } catch (err) {
      console.error('[useMemories] load failed:', err);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  useEffect(() => { load(); }, [load]);

  const remove = useCallback(async (id: string) => {
    setMemories(prev => prev.filter(m => m.id !== id)); // optimistic
    try {
      await (supabase as any).from('user_memories').delete().eq('id', id);
    } catch (err) {
      console.error('[useMemories] delete failed:', err);
      load(); // rollback
    }
  }, [load]);

  const toggle = useCallback(async (id: string, active: boolean) => {
    setMemories(prev => prev.map(m => m.id === id ? { ...m, active } : m));
    try {
      await (supabase as any).from('user_memories').update({ active }).eq('id', id);
    } catch (err) {
      console.error('[useMemories] toggle failed:', err);
      load();
    }
  }, [load]);

  const update = useCallback(async (id: string, content: string) => {
    setMemories(prev => prev.map(m => m.id === id ? { ...m, content } : m));
    try {
      await (supabase as any).from('user_memories').update({ content }).eq('id', id);
    } catch (err) {
      console.error('[useMemories] update failed:', err);
      load();
    }
  }, [load]);

  const add = useCallback(async (kind: MemoryKind, content: string, importance = 0.6) => {
    if (!session?.user?.id) return;
    try {
      const { data, error } = await (supabase as any)
        .from('user_memories')
        .insert({
          user_id: session.user.id,
          kind,
          content,
          importance,
          confidence: 1.0, // user-entered → max confidence
        })
        .select('*')
        .single();
      if (error) throw error;
      setMemories(prev => [data as UserMemory, ...prev]);
    } catch (err) {
      console.error('[useMemories] add failed:', err);
    }
  }, [session?.user?.id]);

  const clearAll = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      await (supabase as any).from('user_memories').delete().eq('user_id', session.user.id);
      setMemories([]);
    } catch (err) {
      console.error('[useMemories] clearAll failed:', err);
    }
  }, [session?.user?.id]);

  return { memories, loading, load, remove, toggle, update, add, clearAll };
};
