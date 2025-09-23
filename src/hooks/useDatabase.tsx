import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import { recordTask as recordTaskAssistant, recordMood, recordGoal, recordKnowledge } from '@/brain/jood';

// TODO: re-enable when remote egress is acceptable
const OFFLINE = (import.meta as any)?.env?.VITE_DEV_OFFLINE === '1';
const ENV_SAVER = (import.meta as any)?.env?.VITE_EGRESS_SAVER === '1';
const EGRESS_SAVER = OFFLINE || ENV_SAVER || (typeof window !== 'undefined' && window.localStorage.getItem('egressSaver') === '1');

// Database types from generated Supabase types
export type Profile = Tables<'profiles'>;

// One-shot write: create a task via Edge Function (no extra fetch on success)
export type RecordTaskInput = {
  title: string;
  dueIso: string; // ISO datetime
  note?: string;
  reminderIso?: string;
};

export async function recordTask(input: RecordTaskInput): Promise<{ id: string; title: string; due_at: string; reminder_at: string | null }> {
  const { data, error } = await supabase.functions.invoke('tasks-actions', {
    body: {
      action: 'create_task',
      title: String(input.title || '').trim(),
      due_at: input.dueIso,
      reminder_at: input.reminderIso ?? null,
      note: input.note ?? null,
    },
  });
  if (error) {
    const status = (error as any)?.status as number | undefined;
    const msg = (error as any)?.message || 'Failed to create task';
    if (status === 400) {
      const e = new Error(msg);
      (e as any).code = 'VALIDATION';
      throw e;
    }
    throw error;
  }
  return data?.task as { id: string; title: string; due_at: string; reminder_at: string | null };
}

// Expenses with wallet guardrails via finance-actions
export type ExpenseInput = {
  amount: number;
  currency?: string;
  category?: string | null;
  description?: string | null;
  date?: string; // ISO
};

export async function recordExpense(input: ExpenseInput, opts?: { precheckWalletSar?: number }): Promise<{ walletBalanceSar: number | null }> {
  if (typeof opts?.precheckWalletSar === 'number' && input.amount > opts.precheckWalletSar) {
    const err = new Error('INSUFFICIENT_FUNDS');
    (err as any).code = 'INSUFFICIENT_FUNDS';
    throw err;
  }
  const { data, error } = await supabase.functions.invoke('finance-actions', {
    body: {
      body: {
        type: 'expense',
        amount: Number(input.amount),
        currency: String(input.currency || 'SAR'),
        category: input.category ?? null,
        description: input.description ?? null,
        occurred_at: input.date || new Date().toISOString(),
      }
    },
  });
  if (error) {
    const status = (error as any)?.status as number | undefined;
    const msg = (error as any)?.message || '';
    if (status === 409 || msg.includes('INSUFFICIENT_FUNDS')) {
      const err = new Error('INSUFFICIENT_FUNDS');
      (err as any).code = 'INSUFFICIENT_FUNDS';
      throw err;
    }
    throw error;
  }
  const bal = (data?.wallet?.balance ?? null) as number | null;
  return { walletBalanceSar: bal };
}

// Portfolio BUY with wallet guardrails via portfolio-actions
export type PortfolioBuyInput = {
  symbol: string;
  quantity: number;
  price: number;
  currency?: string;
};

export async function portfolioBuy(input: PortfolioBuyInput, opts?: { precheckWalletSar?: number }): Promise<{ holdingId: string | null; walletBalanceSar: number | null }> {
  const total = Number(input.quantity) * Number(input.price);
  if (typeof opts?.precheckWalletSar === 'number' && total > opts.precheckWalletSar) {
    const err = new Error('INSUFFICIENT_FUNDS');
    (err as any).code = 'INSUFFICIENT_FUNDS';
    throw err;
  }
  const { data, error } = await supabase.functions.invoke('portfolio-actions', {
    body: {
      action: 'BUY',
      symbol: input.symbol,
      quantity: Number(input.quantity),
      price: Number(input.price),
      currency: input.currency || 'SAR',
    },
  });
  if (error) {
    const status = (error as any)?.status as number | undefined;
    const msg = (error as any)?.message || '';
    if (status === 409 || msg.includes('INSUFFICIENT_FUNDS')) {
      const err = new Error('INSUFFICIENT_FUNDS');
      (err as any).code = 'INSUFFICIENT_FUNDS';
      throw err;
    }
    throw error;
  }
  return {
    holdingId: (data?.holding_id ?? null) as string | null,
    walletBalanceSar: (data?.wallet?.balance ?? null) as number | null,
  };
}

export type FinancialData = Tables<'financial_data'>;

export type Task = Tables<'tasks'>;

export type MoodLog = Tables<'mood_logs'>;

export type PortfolioHolding = Tables<'portfolio_holdings'>;

export type Goal = Tables<'goals'>;

export interface KnowledgeItem {
  id: string;
  user_id: string;
  title: string;
  content?: string | null;
  tags?: string[] | null;
  source?: string | null;
  created_at: string;
  updated_at?: string;
}

// Savings Contribution types and API (top-level)
export type SavingsContribution = {
  id: string;
  user_id: string;
  goal_id: string | null;
  financial_entry_id: string | null;
  amount_sar: number;
  note: string | null;
  created_at: string;
};

export type SavingsContributionInput = {
  amountSar: number;
  goalId?: string;
  note?: string;
};

export type SavingsContributionResult = {
  contribution: SavingsContribution;
  walletBalanceSar: number | null;
};

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

// One-shot write: create a savings contribution via Edge Function
export async function createSavingsContribution(input: SavingsContributionInput): Promise<SavingsContributionResult> {
  const { data, error } = await supabase.functions.invoke('savings-contribute', {
    body: {
      amountSar: input.amountSar,
      goalId: input.goalId ?? null,
      note: input.note ?? null,
    },
  });
  if (error) {
    const status = (error as any)?.status as number | undefined;
    const msg = (error as any)?.message || '';
    if (status === 409 || msg.includes('INSUFFICIENT_FUNDS')) {
      const err = new Error('INSUFFICIENT_FUNDS');
      (err as any).code = 'INSUFFICIENT_FUNDS';
      throw err;
    }
    throw error;
  }
  return {
    contribution: data.contribution as SavingsContribution,
    walletBalanceSar: (data.walletBalanceSar ?? null) as number | null,
  };
}

export const useFinancialData = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [financialData, setFinancialData] = useState<FinancialData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      // TODO: re-enable when remote egress is acceptable
      if (!EGRESS_SAVER) {
        fetchFinancialData();
      }
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
      // TODO: re-enable when remote egress is acceptable
      if (!EGRESS_SAVER) {
        fetchTasks();
      }
    }
  }, [user]);

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

    // Optimistic append with temporary id
    const tempId = `temp-${Date.now()}`;
    const tempTask: Task = {
      id: tempId,
      user_id: user.id,
      title: task.title,
      description: task.description ?? null,
      status: task.status,
      priority: task.priority,
      category: (task as any)?.category ?? 'general',
      due_date: task.due_date ?? null,
      reminder_at: (task as any)?.reminder_at ?? null,
      completed_at: task.completed_at ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setTasks(prev => [tempTask, ...prev]);

    try {
      const prio: 'low' | 'medium' | 'high' =
        task.priority === 'low' || task.priority === 'medium' || task.priority === 'high'
          ? (task.priority as 'low' | 'medium' | 'high')
          : 'medium';

      await recordTaskAssistant({
        title: task.title,
        due_date: task.due_date ?? null,
        priority: prio,
        notes: task.description ?? null,
      });

      // reconcile with server state
      await fetchTasks();
      toast({ title: 'Task added', description: 'Task has been added successfully.' });
    } catch (error: any) {
      // rollback
      setTasks(prev => prev.filter(t => t.id !== tempId));
      toast({ title: 'Error adding task', description: error?.message || 'Failed to add task', variant: 'destructive' });
      throw error;
    }
  };

  const updateTask = async (id: string, updates: Partial<Task>) => {
    if (!user) return;

    // Optimistic update
    const prev = tasks;
    setTasks(curr => curr.map(t => t.id === id ? { ...t, ...updates } as Task : t));
    try {
      const { error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw error;
    } catch (error: any) {
      setTasks(prev);
      toast({ title: 'Error updating task', description: error?.message || 'Failed to update task', variant: 'destructive' });
      throw error;
    }
  };

  const deleteTask = async (id: string) => {
    if (!user) return;

    const prev = tasks;
    setTasks(curr => curr.filter(t => t.id !== id));
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw error;
      toast({ title: 'Task deleted', description: 'Task has been removed.' });
    } catch (error: any) {
      setTasks(prev);
      toast({ title: 'Error deleting task', description: error?.message || 'Failed to delete task', variant: 'destructive' });
      throw error;
    }
  };

  // Realtime subscription for tasks
  useEffect(() => {
    if (!user) return;
    // TODO: re-enable when remote egress is acceptable
    if (EGRESS_SAVER) return;
    const channel = supabase
      .channel('tasks_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tasks', filter: `user_id=eq.${user.id}` }, (payload) => {
        const r: any = payload.new;
        setTasks(prev => prev.some(t => t.id === r.id) ? prev : [{
          id: r.id,
          user_id: r.user_id,
          title: r.title,
          description: r.description,
          status: r.status,
          priority: r.priority,
          category: r.category,
          due_date: r.due_date,
          reminder_at: r.reminder_at,
          completed_at: r.completed_at,
          created_at: r.created_at,
          updated_at: r.updated_at,
        }, ...prev]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tasks', filter: `user_id=eq.${user.id}` }, (payload) => {
        const r: any = payload.new;
        setTasks(prev => prev.map(t => t.id === r.id ? {
          id: r.id,
          user_id: r.user_id,
          title: r.title,
          description: r.description,
          status: r.status,
          priority: r.priority,
          category: r.category,
          due_date: r.due_date,
          reminder_at: r.reminder_at,
          completed_at: r.completed_at,
          created_at: r.created_at,
          updated_at: r.updated_at,
        } : t));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tasks', filter: `user_id=eq.${user.id}` }, (payload) => {
        const r: any = payload.old;
        setTasks(prev => prev.filter(t => t.id !== r.id));
      })
      .subscribe();
    return () => { try { supabase.removeChannel(channel); } catch {} };
  }, [user]);

  // Optimistic-only append to local list (no network)
  const appendLocalTask = (task: Task) => {
    setTasks(prev => [task, ...prev]);
  };

  return { tasks, loading, addTask, updateTask, deleteTask, refetch: fetchTasks, appendLocalTask };
};

export const useMoodLogs = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [moodLogs, setMoodLogs] = useState<MoodLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      // TODO: re-enable when remote egress is acceptable
      if (!EGRESS_SAVER) {
        fetchMoodLogs();
      }
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

    // Optimistic append
    const tempId = `temp-${Date.now()}`;
    const temp: MoodLog = {
      id: tempId,
      user_id: user.id,
      mood_score: mood.mood_score,
      mood_label: mood.mood_label,
      note: mood.note ?? null,
      logged_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    setMoodLogs(prev => [temp, ...prev]);

    try {
      await recordMood({
        mood: mood.mood_label || `${mood.mood_score}`,
        score: mood.mood_score,
        notes: mood.note ?? null,
        occurred_at: new Date().toISOString(),
      });
      await fetchMoodLogs();
      toast({ title: 'Mood logged', description: 'Your mood has been logged successfully.' });
    } catch (error: any) {
      setMoodLogs(prev => prev.filter(m => m.id !== tempId));
      toast({ title: 'Error logging mood', description: error?.message || 'Failed to log mood', variant: 'destructive' });
      throw error;
    }
  };

  const updateMoodLog = async (id: string, updates: Partial<MoodLog>) => {
    if (!user) return;

    const prev = moodLogs;
    setMoodLogs(curr => curr.map(m => m.id === id ? { ...m, ...updates } as MoodLog : m));
    try {
      const payload: any = {};
      if (updates.mood_score != null) payload.mood_score = updates.mood_score;
      if (Object.prototype.hasOwnProperty.call(updates, 'mood_label')) payload.mood_label = updates.mood_label;
      if (Object.prototype.hasOwnProperty.call(updates, 'note')) payload.note = updates.note;
      const { error } = await supabase
        .from('mood_logs')
        .update(payload)
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw error;
    } catch (error: any) {
      setMoodLogs(prev);
      toast({ title: 'Error updating mood', description: error?.message || 'Failed to update mood log', variant: 'destructive' });
      throw error;
    }
  };

  const deleteMoodLog = async (id: string) => {
    if (!user) return;

    const prev = moodLogs;
    setMoodLogs(curr => curr.filter(m => m.id !== id));
    try {
      const { error } = await supabase
        .from('mood_logs')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw error;
      toast({ title: 'Mood deleted', description: 'Mood log removed.' });
    } catch (error: any) {
      setMoodLogs(prev);
      toast({ title: 'Error deleting mood', description: error?.message || 'Failed to delete mood log', variant: 'destructive' });
      throw error;
    }
  };

  // Realtime subscription for mood_logs
  useEffect(() => {
    if (!user) return;
    // TODO: re-enable when remote egress is acceptable
    if (EGRESS_SAVER) return;
    const channel = supabase
      .channel('mood_logs_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mood_logs', filter: `user_id=eq.${user.id}` }, (payload) => {
        const r: any = payload.new;
        setMoodLogs(prev => prev.some(m => m.id === r.id) ? prev : [{
          id: r.id,
          user_id: r.user_id,
          mood_score: r.mood_score,
          mood_label: r.mood_label,
          note: r.note,
          logged_at: r.logged_at,
          created_at: r.created_at,
        }, ...prev]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'mood_logs', filter: `user_id=eq.${user.id}` }, (payload) => {
        const r: any = payload.new;
        setMoodLogs(prev => prev.map(m => m.id === r.id ? {
          id: r.id,
          user_id: r.user_id,
          mood_score: r.mood_score,
          mood_label: r.mood_label,
          note: r.note,
          logged_at: r.logged_at,
          created_at: r.created_at,
        } : m));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'mood_logs', filter: `user_id=eq.${user.id}` }, (payload) => {
        const r: any = payload.old;
        setMoodLogs(prev => prev.filter(m => m.id !== r.id));
      })
      .subscribe();
    return () => { try { supabase.removeChannel(channel); } catch {} };
  }, [user]);

  return { moodLogs, loading, addMoodLog, updateMoodLog, deleteMoodLog, refetch: fetchMoodLogs };
};

// Goals hook with realtime + optimistic
export const useGoals = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      // TODO: re-enable when remote egress is acceptable
      if (!EGRESS_SAVER) { fetchGoals(); }
    }
  }, [user]);

  const fetchGoals = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) {
      toast({ title: 'Error fetching goals', description: error.message, variant: 'destructive' });
    }
    setGoals((data || []) as Goal[]);
    setLoading(false);
  };

  const addGoal = async (g: Omit<Goal, 'id' | 'user_id' | 'created_at'>) => {
    if (!user) return;

    const tempId = `temp-${Date.now()}`;
    const temp: Goal = {
      id: tempId,
      user_id: user.id,
      title: g.title,
      due_date: g.due_date ?? null,
      progress: g.progress ?? 0,
      status: g.status ?? 'active',
      target_amount: g.target_amount ?? 0,
      created_at: new Date().toISOString(),
    };
    setGoals(prev => [temp, ...prev]);

    try {
      await recordGoal({
        title: g.title,
        notes: null,
        target_date: g.due_date ?? null,
        amount_target: g.target_amount ?? null,
      });
      await fetchGoals();
      toast({ title: 'Goal recorded', description: 'Your goal has been added.' });
    } catch (error: any) {
      setGoals(prev => prev.filter(goal => goal.id !== tempId));
      toast({ title: 'Error adding goal', description: error?.message || 'Failed to add goal', variant: 'destructive' });
      throw error;
    }
  };

  const updateGoal = async (id: string, updates: Partial<Goal>) => {
    if (!user) return;

    const prev = goals;
    setGoals(curr => curr.map(goal => goal.id === id ? { ...goal, ...updates } as Goal : goal));
    try {
      const { error } = await supabase
        .from('goals')
        .update(updates as any)
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw error;
    } catch (error: any) {
      setGoals(prev);
      toast({ title: 'Error updating goal', description: error?.message || 'Failed to update goal', variant: 'destructive' });
      throw error;
    }
  };

  const deleteGoal = async (id: string) => {
    if (!user) return;

    const prev = goals;
    setGoals(curr => curr.filter(goal => goal.id !== id));
    try {
      const { error } = await supabase
        .from('goals')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw error;
      toast({ title: 'Goal deleted', description: 'Goal has been removed.' });
    } catch (error: any) {
      setGoals(prev);
      toast({ title: 'Error deleting goal', description: error?.message || 'Failed to delete goal', variant: 'destructive' });
      throw error;
    }
  };

  useEffect(() => {
    if (!user) return;
    // TODO: re-enable when remote egress is acceptable
    if (EGRESS_SAVER) return;
    const channel = supabase
      .channel('goals_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'goals', filter: `user_id=eq.${user.id}` }, (payload) => {
        const r: any = payload.new;
        setGoals(prev => prev.some(g => g.id === r.id) ? prev : [{ ...r } as Goal, ...prev]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'goals', filter: `user_id=eq.${user.id}` }, (payload) => {
        const r: any = payload.new;
        setGoals(prev => prev.map(g => g.id === r.id ? ({ ...r } as Goal) : g));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'goals', filter: `user_id=eq.${user.id}` }, (payload) => {
        const r: any = payload.old;
        setGoals(prev => prev.filter(g => g.id !== r.id));
      })
      .subscribe();
    return () => { try { supabase.removeChannel(channel); } catch {} };
  }, [user]);

  return { goals, loading, addGoal, updateGoal, deleteGoal, refetch: fetchGoals };
};

// Knowledge Vault hook with realtime + optimistic
export const useKnowledgeVault = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      // TODO: re-enable when remote egress is acceptable
      if (!EGRESS_SAVER) { fetchKnowledge(); }
    }
  }, [user]);

  const fetchKnowledge = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('knowledge_vault')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) {
      toast({ title: 'Error fetching knowledge', description: error.message, variant: 'destructive' });
    }
    setItems((data || []) as KnowledgeItem[]);
    setLoading(false);
  };

  const addKnowledge = async (k: Omit<KnowledgeItem, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    if (!user) return;

    const tempId = `temp-${Date.now()}`;
    const temp: KnowledgeItem = { id: tempId, user_id: user.id, title: k.title, content: k.content ?? null, tags: k.tags ?? [], source: k.source ?? null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    setItems(prev => [temp, ...prev]);

    try {
      await recordKnowledge({ title: k.title, content: k.content ?? '', tags: k.tags ?? [], source: k.source ?? null });
      await fetchKnowledge();
      toast({ title: 'Saved', description: 'Knowledge captured.' });
    } catch (error: any) {
      setItems(prev => prev.filter(i => i.id !== tempId));
      toast({ title: 'Error saving knowledge', description: error?.message || 'Failed to save', variant: 'destructive' });
      throw error;
    }
  };

  const updateKnowledge = async (id: string, updates: Partial<KnowledgeItem>) => {
    if (!user) return;

    const prev = items;
    setItems(curr => curr.map(i => i.id === id ? { ...i, ...updates } as KnowledgeItem : i));
    try {
      const payload: Partial<KnowledgeItem> = {};
      if (Object.prototype.hasOwnProperty.call(updates, 'title')) payload.title = updates.title as any;
      if (Object.prototype.hasOwnProperty.call(updates, 'content')) payload.content = updates.content as any;
      if (Object.prototype.hasOwnProperty.call(updates, 'tags')) payload.tags = updates.tags as any;
      if (Object.prototype.hasOwnProperty.call(updates, 'source')) payload.source = updates.source as any;
      const { error } = await supabase
        .from('knowledge_vault')
        .update(payload as any)
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw error;
    } catch (error: any) {
      setItems(prev);
      toast({ title: 'Error updating', description: error?.message || 'Failed to update knowledge', variant: 'destructive' });
      throw error;
    }
  };

  const deleteKnowledge = async (id: string) => {
    if (!user) return;

    const prev = items;
    setItems(curr => curr.filter(i => i.id !== id));
    try {
      const { error } = await supabase
        .from('knowledge_vault')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw error;
      toast({ title: 'Deleted', description: 'Knowledge removed.' });
    } catch (error: any) {
      setItems(prev);
      toast({ title: 'Error deleting', description: error?.message || 'Failed to delete knowledge', variant: 'destructive' });
      throw error;
    }
  };

  useEffect(() => {
    if (!user) return;
    // TODO: re-enable when remote egress is acceptable
    if (EGRESS_SAVER) return;
    const channel = supabase
      .channel('knowledge_vault_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'knowledge_vault', filter: `user_id=eq.${user.id}` }, (payload) => {
        const r: any = payload.new;
        setItems(prev => prev.some(i => i.id === r.id) ? prev : [{ ...r } as KnowledgeItem, ...prev]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'knowledge_vault', filter: `user_id=eq.${user.id}` }, (payload) => {
        const r: any = payload.new;
        setItems(prev => prev.map(i => i.id === r.id ? ({ ...r } as KnowledgeItem) : i));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'knowledge_vault', filter: `user_id=eq.${user.id}` }, (payload) => {
        const r: any = payload.old;
        setItems(prev => prev.filter(i => i.id !== r.id));
      })
      .subscribe();
    return () => { try { supabase.removeChannel(channel); } catch {} };
  }, [user]);

  return { items, loading, addKnowledge, updateKnowledge, deleteKnowledge, refetch: fetchKnowledge };
};