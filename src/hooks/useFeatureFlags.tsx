import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  label: string | null;
}

export const useFeatureFlags = () => {
  const { toast } = useToast();
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [rows, setRows] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFlags = useCallback(async () => {
    const { data, error } = await supabase
      .from('app_feature_flags')
      .select('key, enabled, label')
      .order('key');

    if (error) {
      toast({ title: "Error fetching feature flags", description: error.message, variant: "destructive" });
    } else {
      const data2 = (data || []) as FeatureFlag[];
      setRows(data2);
      setFlags(Object.fromEntries(data2.map(f => [f.key, f.enabled])));
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchFlags();

    const channel = supabase
      .channel('feature-flags-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_feature_flags' }, () => {
        fetchFlags();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchFlags]);

  const setFlag = async (key: string, enabled: boolean) => {
    const { error } = await supabase
      .from('app_feature_flags')
      .update({ enabled, updated_at: new Date().toISOString() })
      .eq('key', key);

    if (error) {
      toast({ title: "Error updating feature flag", description: error.message, variant: "destructive" });
    } else {
      fetchFlags();
    }
  };

  return { flags, rows, loading, setFlag, refetch: fetchFlags };
};
