import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface BriefHighlight {
  kind: 'prayer' | 'finance' | 'memory' | 'event' | 'tip' | string;
  text: string;
  action?: string;
}

export interface DailyBrief {
  id: string | null;
  user_id: string;
  brief_date: string;
  greeting: string;
  content: string;
  highlights: BriefHighlight[];
  suggested_action: string | null;
  read_at: string | null;
  spoken_at: string | null;
  dismissed_at: string | null;
  created_at: string;
  meta?: Record<string, any>;
}

export const useDailyBrief = () => {
  const { session } = useAuth();
  const [brief, setBrief] = useState<DailyBrief | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Generate (or fetch cached) brief ───────────────────────────────────
  const generate = useCallback(async (force = false) => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('daily-brief', {
        body: { force },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (fnErr) throw fnErr;
      if (data?.brief) setBrief(data.brief as DailyBrief);
    } catch (err: any) {
      console.error('[useDailyBrief] failed:', err);
      setError(err?.message ?? 'Failed to generate brief');
    } finally {
      setLoading(false);
    }
  }, [session]);

  // ── Auto-load on mount ─────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    generate(false);
  }, [session, generate]);

  // ── Mark as read ───────────────────────────────────────────────────────
  const markRead = useCallback(async () => {
    if (!brief?.id || brief.read_at) return;
    setBrief(b => b ? { ...b, read_at: new Date().toISOString() } : b);
    try {
      await (supabase as any).from('daily_briefs').update({ read_at: new Date().toISOString() }).eq('id', brief.id);
    } catch { /* non-critical */ }
  }, [brief]);

  const markSpoken = useCallback(async () => {
    if (!brief?.id) return;
    try {
      await (supabase as any).from('daily_briefs').update({ spoken_at: new Date().toISOString() }).eq('id', brief.id);
    } catch { /* non-critical */ }
  }, [brief]);

  const dismiss = useCallback(async () => {
    if (!brief?.id) return;
    setBrief(null);
    try {
      await (supabase as any).from('daily_briefs').update({ dismissed_at: new Date().toISOString() }).eq('id', brief.id);
    } catch { /* non-critical */ }
  }, [brief]);

  return { brief, loading, error, generate, markRead, markSpoken, dismiss };
};
