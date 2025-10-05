import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';

// Database types based on our schema
export interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  interests: string[] | null;
  income: number;
  base_currency: string;
  risk_profile: string;
  created_at: string;
  updated_at: string;
}

export interface FinancialData {
  id: string;
  user_id: string;
  type: 'income' | 'expense' | 'investment' | 'savings';
  amount: number;
  currency: string;
  label: string;
  note: string | null;
  category: string | null;
  created_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: 'pending' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  category: string;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MoodLog {
  id: string;
  user_id: string;
  mood_score: number;
  mood_label: string | null;
  note: string | null;
  created_at: string;
}

export interface PortfolioHolding {
  id: string;
  user_id: string;
  symbol: string;
  market: string;
  quantity: number;
  avg_price: number;
  currency: string;
  is_crypto: boolean;
  created_at: string;
  updated_at: string;
}

export const useProfile = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      toast({
        title: "Error fetching profile",
        description: error.message,
        variant: "destructive",
      });
    }
    
    setProfile(data);
    setLoading(false);
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return;

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('user_id', user.id);

    if (error) {
      toast({
        title: "Error updating profile",
        description: error.message,
        variant: "destructive",
      });
    } else {
      fetchProfile();
      toast({
        title: "Profile updated",
        description: "Your profile has been successfully updated.",
      });
    }
  };

  return { profile, loading, updateProfile, refetch: fetchProfile };
};

export const useFinancialData = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [financialData, setFinancialData] = useState<FinancialData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchFinancialData();
    }
  }, [user]);

  const fetchFinancialData = async () => {
    if (!user) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('financial_data')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: "Error fetching financial data",
        description: error.message,
        variant: "destructive",
      });
    }
    
    setFinancialData((data || []) as FinancialData[]);
    setLoading(false);
  };

  const addFinancialEntry = async (entry: Omit<FinancialData, 'id' | 'user_id' | 'created_at'>) => {
    if (!user) return;

    const { error } = await supabase
      .from('financial_data')
      .insert({ ...entry, user_id: user.id });

    if (error) {
      toast({
        title: "Error adding financial entry",
        description: error.message,
        variant: "destructive",
      });
    } else {
      fetchFinancialData();
      toast({
        title: "Entry added",
        description: "Financial entry has been added successfully.",
      });
    }
  };

  return { financialData, loading, addFinancialEntry, refetch: fetchFinancialData };
};

export const useTasks = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchTasks();
    }
  }, [user]);

  const fetchTasks = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('tasks-actions', {
        body: { action: 'list' },
        headers: {
          Authorization: `Bearer ${supabase.auth.getSession().then(({ data }) => data.session?.access_token)}`,
        },
      });

      if (error) throw error;
      setTasks(data.tasks || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast({
        title: "Error fetching tasks",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addTask = async (task: Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    if (!user) return;

    try {
      const { error } = await supabase.functions.invoke('tasks-actions', {
        body: { action: 'create', task },
        headers: {
          Authorization: `Bearer ${supabase.auth.getSession().then(({ data }) => data.session?.access_token)}`,
        },
      });

      if (error) throw error;
      fetchTasks();
      toast({
        title: "Task added",
        description: "Task has been added successfully.",
      });
    } catch (error) {
      toast({
        title: "Error adding task",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const updateTask = async (id: string, updates: Partial<Task>) => {
    if (!user) return;

    try {
      const { error } = await supabase.functions.invoke('tasks-actions', {
        body: { action: 'update', id, updates },
        headers: {
          Authorization: `Bearer ${supabase.auth.getSession().then(({ data }) => data.session?.access_token)}`,
        },
      });

      if (error) throw error;
      fetchTasks();
    } catch (error) {
      toast({
        title: "Error updating task",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return { tasks, loading, addTask, updateTask, refetch: fetchTasks };
};

export const useWallet = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [wallet, setWalletState] = useState<{ balance: number; currency: string; updated_at: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchWallet();
    }
  }, [user]);

  const fetchWallet = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // TODO: Prefer profiles.wallet_balance_sar once types.generated includes it
      // For now, use the wallets table as the canonical single source
      const { data, error } = await supabase
        .from('wallets')
        .select('balance, currency, updated_at')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      if (data) {
        setWalletState({
          balance: Number(data.balance),
          currency: data.currency,
          updated_at: data.updated_at,
        });
      } else {
        // Initialize with zero balance if no wallet exists
        setWalletState({
          balance: 0,
          currency: 'SAR',
          updated_at: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Error fetching wallet:', error);
      toast({
        title: "Error fetching wallet",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const setWallet = async (balance: number, currency: string = 'SAR') => {
    if (!user) return;

    try {
      const { data, error } = await supabase.rpc('adjust_wallet', {
        _delta: balance - (wallet?.balance || 0),
        _currency: currency
      });

      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;
      if (row) {
        setWalletState({
          balance: Number(row.balance),
          currency: row.currency,
          updated_at: row.updated_at,
        });
      } else {
        await fetchWallet();
      }
    } catch (error) {
      toast({
        title: "Failed to set wallet",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  const adjustWallet = async (delta: number, currency: string = 'SAR') => {
    if (!user) return;

    try {
      const { data, error } = await supabase.rpc('adjust_wallet', {
        _delta: delta,
        _currency: currency
      });

      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;
      if (row) {
        setWalletState({
          balance: Number(row.balance),
          currency: row.currency,
          updated_at: row.updated_at,
        });
      } else {
        await fetchWallet();
      }
    } catch (error) {
      toast({
        title: "Wallet adjust failed",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  return {
    wallet,
    loading,
    refetch: fetchWallet,
    setWallet,
    adjustWallet,
  };
};

export const useMoodLogs = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [moodLogs, setMoodLogs] = useState<MoodLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchMoodLogs();
    }
  }, [user]);

  const fetchMoodLogs = async () => {
    if (!user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('mood_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: "Error fetching mood logs",
        description: error.message,
        variant: "destructive",
      });
    }

    setMoodLogs(data || []);
    setLoading(false);
  };

  const addMoodLog = async (mood: Omit<MoodLog, 'id' | 'user_id' | 'created_at'>) => {
    if (!user) return;

    const { error } = await supabase
      .from('mood_logs')
      .insert({ ...mood, user_id: user.id });

    if (error) {
      toast({
        title: "Error logging mood",
        description: error.message,
        variant: "destructive",
      });
    } else {
      fetchMoodLogs();
      toast({
        title: "Mood logged",
        description: "Your mood has been logged successfully.",
      });
    }
  };

  return { moodLogs, loading, addMoodLog, refetch: fetchMoodLogs };
};