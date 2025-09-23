import { supabase } from '@/integrations/supabase/client';

// Utility: get a fresh access token to call Edge Functions
async function getAccessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not authenticated');
  return token;
}

// Helper to invoke a Supabase Edge Function with Authorization header
async function invokeFunction<T = any>(name: string, body: any): Promise<T> {
  const token = await getAccessToken();
  const { data, error } = await supabase.functions.invoke(name, {
    body,
    headers: { Authorization: `Bearer ${token}` },
  });
  if (error) throw error;
  return data as T;
}

// Financial entry payload (unified)
// expected by finance-actions to ultimately write to public.financial_entries
export type FinancialEntryPayload = {
  type: 'income' | 'expense' | 'savings';
  amount: number;
  currency: string;
  category?: string | null;
  description?: string | null;
  occurred_at?: string; // ISO datetime
};

export async function recordFinancialEntry(payload: FinancialEntryPayload) {
  // Route to finance-actions edge function (server decides table mapping)
  return invokeFunction('finance-actions', {
    method: 'POST',
    body: payload,
  });
}

// Generic record payloads for Assistant actions
export type TaskPayload = {
  title: string;
  due_date?: string | null; // ISO datetime
  priority?: 'low' | 'medium' | 'high';
  notes?: string | null;
};

export type MoodPayload = {
  mood: string; // e.g., "happy", "stressed"
  score?: number; // 1-10
  notes?: string | null;
  occurred_at?: string; // ISO datetime
};

export type GoalPayload = {
  title: string;
  target_date?: string | null; // ISO date
  amount_target?: number | null;
  notes?: string | null;
};

export type KnowledgePayload = {
  title: string;
  content: string;
  tags?: string[];
  source?: string | null;
  occurred_at?: string; // ISO datetime for when the knowledge was acquired
};

export async function recordTask(payload: TaskPayload) {
  return invokeFunction('assistant-actions', {
    method: 'POST',
    resource: 'task',
    body: payload,
  });
}

export async function recordMood(payload: MoodPayload) {
  return invokeFunction('assistant-actions', {
    method: 'POST',
    resource: 'mood',
    body: payload,
  });
}

export async function recordGoal(payload: GoalPayload) {
  return invokeFunction('assistant-actions', {
    method: 'POST',
    resource: 'goal',
    body: payload,
  });
}

export async function recordKnowledge(payload: KnowledgePayload) {
  return invokeFunction('assistant-actions', {
    method: 'POST',
    resource: 'knowledge',
    body: payload,
  });
}

export type MemoryQueryParams = {
  query: string; // natural language query like "what did I spend last week?"
  timeframe?: string; // e.g., 'yesterday', 'last week', 'last month', 'Q1/2025'
  target?: 'finance' | 'tasks' | 'mood' | 'goals' | 'knowledge' | 'categories';
  tags?: string[];
};

export async function queryMemory(params: MemoryQueryParams) {
  return invokeFunction('memory-query', params);
}
