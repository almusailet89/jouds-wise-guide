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
    if (!user) return;
    fetchTasks();

    const channel = supabase
      .channel(`tasks-rt-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${user.id}` }, () => {
        fetchTasks();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const fetchTasks = async () => {
    if (!user) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: "Error fetching tasks",
        description: error.message,
        variant: "destructive",
      });
    }
    
    setTasks((data || []) as Task[]);
    setLoading(false);
  };

  const addTask = async (task: Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    if (!user) return;

    const { error } = await supabase
      .from('tasks')
      .insert({ ...task, user_id: user.id });

    if (error) {
      toast({
        title: "Error adding task",
        description: error.message,
        variant: "destructive",
      });
    } else {
      fetchTasks();
      toast({
        title: "Task added",
        description: "Task has been added successfully.",
      });
    }
  };

  const updateTask = async (id: string, updates: Partial<Task>) => {
    if (!user) return;

    const { error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      toast({
        title: "Error updating task",
        description: error.message,
        variant: "destructive",
      });
    } else {
      fetchTasks();
    }
  };

  return { tasks, loading, addTask, updateTask, refetch: fetchTasks };
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

// ─── Goals ────────────────────────────────────────────────────────────────────
export interface Goal {
  id: string;
  user_id: string;
  title: string;
  target_amount: number;
  saved_amount: number;
  target_date: string | null;
  status: 'active' | 'completed' | 'cancelled';
  icon: string | null;
  color: string | null;
  created_at: string;
  updated_at: string;
}

export const useGoals = () => {
  const { user } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGoals = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from('goals')
      .select('*')
      .eq('user_id', user.id)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false });
    setGoals(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    fetchGoals();

    // Realtime — goals added/updated via chat appear instantly
    const channel = (supabase as any)
      .channel(`goals-rt-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'goals', filter: `user_id=eq.${user.id}` }, () => fetchGoals())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const addGoal = async (goal: Pick<Goal, 'title' | 'target_amount' | 'saved_amount' | 'target_date'>) => {
    if (!user) return;
    await (supabase as any).from('goals').insert({ ...goal, user_id: user.id, status: 'active' });
    fetchGoals();
  };

  const updateGoal = async (id: string, updates: Partial<Goal>) => {
    if (!user) return;
    await (supabase as any).from('goals').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
    fetchGoals();
  };

  const deleteGoal = async (id: string) => {
    if (!user) return;
    await (supabase as any).from('goals').update({ status: 'cancelled' }).eq('id', id);
    fetchGoals();
  };

  return { goals, loading, addGoal, updateGoal, deleteGoal, refetch: fetchGoals };
};