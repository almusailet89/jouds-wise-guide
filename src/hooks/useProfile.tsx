import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface UserProfile {
  id?: string;
  user_id: string;
  display_name: string | null;
  gender: 'male' | 'female' | null;
  phone: string | null;
  date_of_birth: string | null;
  city: string | null;
  nationality: string | null;
  avatar_emoji: string | null;
  bio: string | null;
  interests: string[] | null;
  income: number | null;
  base_currency: string | null;
  risk_profile: string | null;
}

export function useProfile() {
  const { user, session } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    setLoading(true);
    const { data } = await (supabase as any)
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();
    setProfile(data ?? { user_id: user.id, display_name: null, gender: null, phone: null, date_of_birth: null, city: null, nationality: 'SA', avatar_emoji: '🌟', bio: null, interests: [], income: 0, base_currency: 'SAR', risk_profile: 'balanced' });
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (updates: Partial<UserProfile>) => {
    if (!user?.id) return { error: 'Not authenticated' };
    setSaving(true);
    const { error } = await (supabase as any)
      .from('profiles')
      .upsert({ user_id: user.id, ...updates, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (!error) {
      setProfile(prev => prev ? { ...prev, ...updates } : null);
      // Sync display_name back to Supabase auth metadata so other parts of app see it
      if (updates.display_name || updates.gender) {
        await supabase.auth.updateUser({ data: { display_name: updates.display_name, gender: updates.gender } });
      }
    }
    setSaving(false);
    return { error };
  }, [user?.id]);

  /** Derived: what suffix Jood uses in Arabic for this user */
  const genderSuffix = profile?.gender === 'female' ? 'feminine' : 'masculine';

  return { profile, loading, saving, save, reload: load, genderSuffix };
}
