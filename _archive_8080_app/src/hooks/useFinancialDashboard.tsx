import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Tables, TablesUpdate } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { recordFinancialEntry } from '@/brain/jood';
import { useGoals } from '@/hooks/useDatabase';

export interface FinancialEntry {
  id: string;
  type: 'income' | 'expense' | 'savings';
  amount: number;
  currency: string;
  category: string;
  description?: string;
  date: string;
  created_at: string;
}

export type PortfolioHolding = Tables<'portfolio_holdings'>;

export interface Insight {
  type: 'performance' | 'drawdown' | 'allocation' | 'savings';
  symbol: string;
  message: string;
  value: number;
  timeframe: string;
}

export interface GoalSummary {
  id: string;
  title: string;
  amount_target?: number | null;
}

// TODO: re-enable when remote egress is acceptable
const OFFLINE = import.meta.env?.VITE_DEV_OFFLINE === '1';
const ENV_SAVER = import.meta.env?.VITE_EGRESS_SAVER === '1';

export const useFinancialDashboard = (opts?: { egressSaver?: boolean }) => {
  const { user } = useAuth();
  // Egress saver: enabled if OFFLINE or explicitly passed from UI
  const EGRESS_SAVER = OFFLINE || ENV_SAVER || !!opts?.egressSaver;
  const [financialEntries, setFinancialEntries] = useState<FinancialEntry[]>([]);
  const [portfolioHoldings, setPortfolioHoldings] = useState<PortfolioHolding[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [news, setNews] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(false);
  const [portfolioSummary, setPortfolioSummary] = useState<any>(null);
  const [walletBalanceSar, setWalletBalanceSar] = useState<number | null>(null);

  // Read goals via existing hook (it self-gates in Saver Mode)
  const { goals } = useGoals();
  const goalSummaries: GoalSummary[] = useMemo(() =>
    (goals || []).map(g => ({ id: g.id, title: g.title, amount_target: g.target_amount ?? null })),
    [goals]
  );

  // Savings progress derived from in-memory financial entries
  const savingsProgress = useMemo(() => {
    const now = new Date();
    const m = now.getMonth();
    const y = now.getFullYear();
    const monthToDateSar = (financialEntries || [])
      .filter(e => e.type === 'savings')
      .filter(e => { const d = new Date(e.date); return d.getMonth() === m && d.getFullYear() === y; })
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const last = (financialEntries || [])
      .filter(e => e.type === 'savings')
      .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    return { monthToDateSar, lastContributionSar: last ? Number(last.amount) : undefined };
  }, [financialEntries]);

  // Fetch financial entries from unified table
  const fetchFinancialEntries = useCallback(async (range?: string) => {
    if (!user) return;

    try {
      // Optional range filter (7d, 30d, ytd)
      let query = supabase
        .from('financial_entries')
        .select('id, type, amount, currency, category, description, occurred_at, created_at')
        .eq('user_id', user.id)
        .order('occurred_at', { ascending: false });

      if (range) {
        const now = new Date();
        let startDate: Date | undefined;
        if (range === '7d') {
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        } else if (range === '30d') {
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        } else if (range === 'ytd') {
          startDate = new Date(now.getFullYear(), 0, 1);
        }
        if (startDate) {
          query = query.gte('occurred_at', startDate.toISOString());
        }
      }

      const { data, error } = await query;
      if (error) throw error;

      const mapped: FinancialEntry[] = (data || []).map((r: any) => ({
        id: r.id,
        type: r.type,
        amount: Number(r.amount),
        currency: r.currency,
        category: r.category,
        description: r.description,
        date: r.occurred_at,
        created_at: r.created_at,
      }));
      setFinancialEntries(mapped);
    } catch (error) {
      console.error('Error fetching financial entries:', error);
      toast.error('Failed to fetch financial entries');
    }
  }, [user]);

  // Fetch portfolio holdings
  const fetchPortfolioHoldings = useCallback(async (force = false) => {
    if (!user) return;
    // TODO: re-enable when remote egress is acceptable
    if (EGRESS_SAVER && !force) { setPortfolioHoldings([]); return; }

    try {
      const { data, error } = await supabase.functions.invoke('manage-portfolio', {
        body: { method: 'GET' }
      });

      if (error) throw error;
      const rows = data.data || [];
      setPortfolioHoldings(rows);
      return rows as PortfolioHolding[];
    } catch (error) {
      console.error('Error fetching portfolio holdings:', error);
      toast.error('Failed to fetch portfolio holdings');
    }
  }, [user]);

  // Fetch portfolio summary
  const fetchPortfolioSummary = useCallback(async (force = false) => {
    if (!user) return;
    // TODO: re-enable when remote egress is acceptable
    if (EGRESS_SAVER && !force) { setPortfolioSummary(null); return; }

    try {
      const { data, error } = await supabase.functions.invoke('manage-portfolio', {
        body: { method: 'SUMMARY' }
      });

      if (error) throw error;
      const summary = data.data || {};
      setPortfolioSummary(summary);
      return summary;
    } catch (error) {
      console.error('Error fetching portfolio summary:', error);
    }
  }, [user]);

  // Fetch insights
  const fetchInsights = useCallback(async () => {
    if (!user) return;
    // TODO: re-enable when remote egress is acceptable
    if (EGRESS_SAVER) { setInsights([]); return; }

    try {
      const { data, error } = await supabase.functions.invoke('get-financial-insights');

      if (error) throw error;
      setInsights(data.insights || []);
    } catch (error) {
      console.error('Error fetching insights:', error);
    }
  }, [user]);

  // Fetch news
  const fetchNews = useCallback(async (symbols: string[], force = false) => {
    if (!user || symbols.length === 0) return;
    // TODO: re-enable when remote egress is acceptable
    if (EGRESS_SAVER && !force) { return; }

    try {
      const { data, error } = await supabase.functions.invoke('get-financial-news', {
        body: { symbols }
      });

      if (error) throw error;
      setNews(data.news || {});
    } catch (error) {
      console.error('Error fetching news:', error);
    }
  }, [user]);

  // Refresh prices
  const refreshPrices = useCallback(async () => {
    setLoading(true);
    try {
      // Prevent remote calls when truly offline
      if (OFFLINE) { toast('Offline mode: refresh disabled'); return; }
      const { data, error } = await supabase.functions.invoke('refresh-prices');

      if (error) throw error;
      
      toast.success(`Updated ${data.updated_count} asset prices`);
      const rows = await fetchPortfolioHoldings(true);
      await fetchPortfolioSummary(true);
      // Fetch news once if we have symbols (even in saver mode)
      const symbols = (rows || [])
        .filter((h: any) => h.symbol)
        .map((h: any) => h.symbol as string)
        .slice(0, 10);
      if (symbols.length > 0) {
        await fetchNews(symbols, true);
      }
    } catch (error) {
      console.error('Error refreshing prices:', error);
      toast.error('Failed to refresh prices');
    } finally {
      setLoading(false);
    }
  }, [fetchPortfolioHoldings, fetchPortfolioSummary, fetchNews]);

  // Add financial entry (optimistic)
  const addFinancialEntry = useCallback(async (entry: Omit<FinancialEntry, 'id' | 'created_at'>) => {
    if (!user) return;

    // Optimistic append with temporary id
    const tempId = `temp-${Date.now()}`;
    const temp: FinancialEntry = {
      id: tempId,
      type: entry.type,
      amount: entry.amount,
      currency: entry.currency,
      category: entry.category,
      description: entry.description,
      date: entry.date || new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    setFinancialEntries(prev => [temp, ...prev]);

    try {
      await recordFinancialEntry({
        type: entry.type,
        amount: entry.amount,
        currency: entry.currency,
        category: entry.category ?? null,
        description: entry.description ?? null,
        occurred_at: entry.date || new Date().toISOString(),
      });

      // Refresh to reconcile temp with saved row (Realtime may also populate)
      await fetchFinancialEntries();
      toast.success('Entry saved');
    } catch (error: any) {
      // Rollback optimistic add
      setFinancialEntries(prev => prev.filter(e => e.id !== tempId));
      console.error('Error adding financial entry:', error);
      toast.error(error?.message || 'Failed to save entry');
      throw error;
    }
  }, [user, fetchFinancialEntries]);

  // Update financial entry (optimistic)
  const updateFinancialEntry = useCallback(async (id: string, updates: Partial<FinancialEntry>) => {
    if (!user) return;

    // Snapshot for rollback
    const prev = financialEntries;
    setFinancialEntries(curr => curr.map(e => e.id === id ? { ...e, ...updates } as FinancialEntry : e));

    try {
      const payload: TablesUpdate<'financial_entries'> = {};
      if (updates.type != null) payload.type = updates.type;
      if (updates.amount != null) payload.amount = updates.amount as number;
      if (updates.currency != null) payload.currency = updates.currency as string;
      if (Object.prototype.hasOwnProperty.call(updates, 'category')) payload.category = updates.category ?? null;
      if (Object.prototype.hasOwnProperty.call(updates, 'description')) payload.description = updates.description ?? null;
      if (Object.prototype.hasOwnProperty.call(updates, 'date')) payload.occurred_at = updates.date as string;

      const { data, error } = await supabase
        .from('financial_entries')
        .update(payload)
        .eq('id', id)
        .eq('user_id', user.id)
        .select('id')
        .single();

      if (error) throw error;

      toast.success('Entry updated');
      return data;
    } catch (err) {
      console.error('Error updating financial entry:', err);
      toast.error('Failed to update entry');
      // Rollback
      setFinancialEntries(prev);
      throw err;
    }
  }, [user, financialEntries]);

  // Delete financial entry (optimistic)
  const deleteFinancialEntry = useCallback(async (id: string) => {
    if (!user) return;

    // Optimistic removal
    const prev = financialEntries;
    setFinancialEntries(curr => curr.filter(e => e.id !== id));

    try {
      const { error } = await supabase
        .from('financial_entries')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      if (error) throw error;

      toast.success('Entry deleted');
    } catch (error) {
      console.error('Error deleting financial entry:', error);
      toast.error('Failed to delete entry');
      // Rollback
      setFinancialEntries(prev);
      throw error;
    }
  }, [user, financialEntries]);

  // Add portfolio holding
  const addPortfolioHolding = useCallback(async (holding: Omit<PortfolioHolding, 'id' | 'created_at'>) => {
    if (!user) return;

    try {
      const { data, error } = await supabase.functions.invoke('manage-portfolio', {
        body: { method: 'POST', body: holding }
      });

      if (error) throw error;
      
      toast.success('Holding added');
      await fetchPortfolioHoldings();
      await fetchPortfolioSummary();
      return data.data;
    } catch (error) {
      console.error('Error adding portfolio holding:', error);
      toast.error(error.message || 'Failed to add holding');
      throw error;
    }
  }, [user, fetchPortfolioHoldings, fetchPortfolioSummary]);

  // Update portfolio holding
  const updatePortfolioHolding = useCallback(async (id: string, updates: Partial<PortfolioHolding>) => {
    if (!user) return;

    try {
      const { data, error } = await supabase.functions.invoke('manage-portfolio', {
        body: { method: 'PATCH', body: { id, updates } }
      });

      if (error) throw error;
      
      toast.success('Holding updated');
      await fetchPortfolioHoldings();
      await fetchPortfolioSummary();
      return data.data;
    } catch (error) {
      console.error('Error updating portfolio holding:', error);
      toast.error('Failed to update holding');
      throw error;
    }
  }, [user, fetchPortfolioHoldings, fetchPortfolioSummary]);

  // Delete portfolio holding
  const deletePortfolioHolding = useCallback(async (id: string) => {
    if (!user) return;

    try {
      const { error } = await supabase.functions.invoke('manage-portfolio', {
        body: { method: 'DELETE', body: { id } }
      });

      if (error) throw error;
      
      toast.success('Holding deleted');
      await fetchPortfolioHoldings();
      await fetchPortfolioSummary();
    } catch (error) {
      console.error('Error deleting portfolio holding:', error);
      toast.error('Failed to delete holding');
      throw error;
    }
  }, [user, fetchPortfolioHoldings, fetchPortfolioSummary]);

  // Initial data fetch
  useEffect(() => {
    if (user) {
      // TODO: re-enable when remote egress is acceptable
      if (EGRESS_SAVER) {
        fetchFinancialEntries();
      } else {
        fetchFinancialEntries();
        fetchPortfolioHoldings();
        fetchPortfolioSummary();
        fetchInsights();
      }
    }
  }, [user, fetchFinancialEntries, fetchPortfolioHoldings, fetchPortfolioSummary, fetchInsights, EGRESS_SAVER]);

  // Wallet realtime subscription: only when not in Saver and not Offline
  useEffect(() => {
    if (!user) return;
    if (EGRESS_SAVER || OFFLINE) return;
    const channel = supabase
      .channel('wallets_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wallets', filter: `user_id=eq.${user.id}` }, (payload) => {
        const r: any = payload.new || payload.old;
        if (r && typeof r.balance !== 'undefined') {
          setWalletBalanceSar(Number(r.balance));
        }
      })
      .subscribe();

    return () => { try { supabase.removeChannel(channel); } catch {} };
  }, [user, EGRESS_SAVER, OFFLINE]);

  // Financial entries realtime subscription (disabled in Offline only; allowed in Saver)
  useEffect(() => {
    if (!user) return;
    if (OFFLINE) return;
    const channel = supabase
      .channel('financial_entries_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'financial_entries', filter: `user_id=eq.${user.id}` }, (payload) => {
        const r: any = payload.new;
        setFinancialEntries(prev => {
          if (prev.some(e => e.id === r.id)) return prev;
          const mapped: FinancialEntry = {
            id: r.id,
            type: r.type,
            amount: Number(r.amount),
            currency: r.currency,
            category: r.category,
            description: r.description || undefined,
            date: r.occurred_at || r.created_at,
            created_at: r.created_at,
          };
          return [mapped, ...prev];
        });
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'financial_entries', filter: `user_id=eq.${user.id}` }, (payload) => {
        const r: any = payload.old;
        setFinancialEntries(prev => prev.filter(e => e.id !== r.id));
      })
      .subscribe();
    return () => { try { supabase.removeChannel(channel); } catch {} };
  }, [user, EGRESS_SAVER, OFFLINE]);

  // Fetch news when holdings change
  useEffect(() => {
    const symbols = portfolioHoldings
      .filter(h => h.symbol)
      .map(h => h.symbol!)
      .slice(0, 10); // Limit to prevent API overload

    // TODO: re-enable when remote egress is acceptable
    if (symbols.length > 0 && !EGRESS_SAVER) {
      fetchNews(symbols);
    }
  }, [portfolioHoldings, fetchNews, EGRESS_SAVER]);

  // Optimistically apply a savings contribution to local state without any fetches
  const applySavingsContribution = useCallback((args: {
    amountSar: number;
    note?: string | null;
    walletBalanceSar?: number | null;
    financial_entry_id?: string | null;
    created_at?: string;
  }) => {
    const { amountSar, note, walletBalanceSar: newBal, financial_entry_id, created_at } = args;
    if (typeof newBal === 'number') setWalletBalanceSar(newBal);
    const tempId = financial_entry_id || `temp-${Date.now()}`;
    const nowIso = created_at || new Date().toISOString();
    const tempEntry: FinancialEntry = {
      id: String(tempId),
      type: 'savings',
      amount: Number(amountSar),
      currency: 'SAR',
      category: 'savings',
      description: note || undefined,
      date: nowIso,
      created_at: nowIso,
    };
    setFinancialEntries(prev => [tempEntry, ...prev]);
  }, []);

  // Reset local in-memory state (used after admin reset)
  const resetLocalState = useCallback(() => {
    setFinancialEntries([]);
    setPortfolioHoldings([]);
    setPortfolioSummary(null);
    setInsights([]);
    setNews({});
    setWalletBalanceSar(0);
  }, []);

  return {
    // Data
    financialEntries,
    portfolioHoldings,
    portfolioSummary,
    insights,
    news,
    loading,
    walletBalanceSar,
    goals: goalSummaries,
    savingsProgress,

    // Financial entries CRUD
    addFinancialEntry,
    updateFinancialEntry,
    deleteFinancialEntry,
    fetchFinancialEntries,

    // Portfolio holdings CRUD
    addPortfolioHolding,
    updatePortfolioHolding,
    deletePortfolioHolding,
    fetchPortfolioHoldings,
    fetchPortfolioSummary,

    // Utilities
    refreshPrices,
    fetchInsights,
    fetchNews,
    applySavingsContribution,
    resetLocalState,
  };
};