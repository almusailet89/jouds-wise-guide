import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

export interface PortfolioHolding {
  id: string;
  asset_type: 'stock' | 'crypto' | 'real_estate';
  symbol?: string;
  quantity?: number;
  avg_price?: number;
  current_price?: number;
  currency: string;
  created_at: string;
  last_updated?: string;
  address?: string;
  property_type?: string;
  sqft?: number;
  purchase_price?: number;
}

export interface Insight {
  type: 'performance' | 'drawdown' | 'allocation' | 'savings';
  symbol: string;
  message: string;
  value: number;
  timeframe: string;
}

export interface SavingsTarget {
  monthly_savings_target: number;
  savings_target_date: string;
}

export const useFinancialDashboard = () => {
  const { user, session } = useAuth();
  const [financialEntries, setFinancialEntries] = useState<FinancialEntry[]>([]);
  const [portfolioHoldings, setPortfolioHoldings] = useState<PortfolioHolding[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [news, setNews] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(false);
  const [portfolioSummary, setPortfolioSummary] = useState<any>(null);
  const [savingsTarget, setSavingsTarget] = useState<SavingsTarget | null>(null);

  // Fetch financial entries
  const fetchFinancialEntries = useCallback(async (range?: string) => {
    if (!user || !session) return;

    try {
      const { data, error } = await supabase.functions.invoke('manage-finance', {
        body: { method: 'GET', body: { range } },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      setFinancialEntries(data.data || []);
    } catch (error) {
      console.error('Error fetching financial entries:', error);
      toast.error('Failed to fetch financial entries');
    }
  }, [user, session]);

  // Fetch portfolio holdings
  const fetchPortfolioHoldings = useCallback(async () => {
    if (!user || !session) return;

    try {
      const { data, error } = await supabase.functions.invoke('manage-portfolio', {
        body: { method: 'GET' },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      setPortfolioHoldings(data.data || []);
    } catch (error) {
      console.error('Error fetching portfolio holdings:', error);
      toast.error('Failed to fetch portfolio holdings');
    }
  }, [user, session]);

  // Fetch portfolio summary
  const fetchPortfolioSummary = useCallback(async () => {
    if (!user || !session) return;

    try {
      const { data, error } = await supabase.functions.invoke('manage-portfolio', {
        body: { method: 'SUMMARY' },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      setPortfolioSummary(data.data || {});
    } catch (error) {
      console.error('Error fetching portfolio summary:', error);
    }
  }, [user, session]);

  // Fetch savings target
  const fetchSavingsTarget = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('monthly_savings_target, savings_target_date')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setSavingsTarget({
          monthly_savings_target: data.monthly_savings_target || 0,
          savings_target_date: data.savings_target_date || new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Error fetching savings target:', error);
    }
  }, [user]);

  // Update savings target
  const updateSavingsTarget = useCallback(async (target: number, targetDate?: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          monthly_savings_target: target,
          savings_target_date: targetDate || new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (error) throw error;
      
      await fetchSavingsTarget();
      toast.success('Savings target updated');
    } catch (error) {
      console.error('Error updating savings target:', error);
      toast.error('Failed to update savings target');
      throw error;
    }
  }, [user, fetchSavingsTarget]);

  // Fetch insights
  const fetchInsights = useCallback(async () => {
    if (!user || !session) return;

    try {
      const { data, error } = await supabase.functions.invoke('get-financial-insights', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      setInsights(data.insights || []);
    } catch (error) {
      console.error('Error fetching insights:', error);
    }
  }, [user, session]);

  // Fetch news
  const fetchNews = useCallback(async (symbols: string[]) => {
    if (!user || symbols.length === 0) return;

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
      const { data, error } = await supabase.functions.invoke('refresh-prices');

      if (error) throw error;
      
      toast.success(`Updated ${data.updated_count} asset prices`);
      await fetchPortfolioHoldings();
      await fetchPortfolioSummary();
    } catch (error) {
      console.error('Error refreshing prices:', error);
      toast.error('Failed to refresh prices');
    } finally {
      setLoading(false);
    }
  }, [fetchPortfolioHoldings, fetchPortfolioSummary]);

  // Add financial entry
  const addFinancialEntry = useCallback(async (entry: Omit<FinancialEntry, 'id' | 'created_at'>) => {
    if (!user || !session) return;

    try {
      const { data, error } = await supabase.functions.invoke('manage-finance', {
        body: { method: 'POST', body: entry },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      
      toast.success('Entry saved');
      await fetchFinancialEntries();
      return data.data;
    } catch (error) {
      console.error('Error adding financial entry:', error);
      toast.error('Failed to save entry');
      throw error;
    }
  }, [user, session, fetchFinancialEntries]);

  // Update financial entry
  const updateFinancialEntry = useCallback(async (id: string, updates: Partial<FinancialEntry>) => {
    if (!user || !session) return;

    try {
      const { data, error } = await supabase.functions.invoke('manage-finance', {
        body: { method: 'PATCH', body: { id, updates } },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      
      toast.success('Entry updated');
      await fetchFinancialEntries();
      return data.data;
    } catch (error) {
      console.error('Error updating financial entry:', error);
      toast.error('Failed to update entry');
      throw error;
    }
  }, [user, session, fetchFinancialEntries]);

  // Delete financial entry
  const deleteFinancialEntry = useCallback(async (id: string) => {
    if (!user || !session) return;

    try {
      const { error } = await supabase.functions.invoke('manage-finance', {
        body: { method: 'DELETE', body: { id } },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      
      toast.success('Entry deleted');
      await fetchFinancialEntries();
    } catch (error) {
      console.error('Error deleting financial entry:', error);
      toast.error('Failed to delete entry');
      throw error;
    }
  }, [user, session, fetchFinancialEntries]);

  // Add portfolio holding
  const addPortfolioHolding = useCallback(async (holding: Omit<PortfolioHolding, 'id' | 'created_at'>) => {
    if (!user || !session) return;

    try {
      const { data, error } = await supabase.functions.invoke('manage-portfolio', {
        body: { method: 'POST', body: holding },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
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
  }, [user, session, fetchPortfolioHoldings, fetchPortfolioSummary]);

  // Update portfolio holding
  const updatePortfolioHolding = useCallback(async (id: string, updates: Partial<PortfolioHolding>) => {
    if (!user || !session) return;

    try {
      const { data, error } = await supabase.functions.invoke('manage-portfolio', {
        body: { method: 'PATCH', body: { id, updates } },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
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
  }, [user, session, fetchPortfolioHoldings, fetchPortfolioSummary]);

  // Delete portfolio holding
  const deletePortfolioHolding = useCallback(async (id: string) => {
    if (!user || !session) return;

    try {
      const { error } = await supabase.functions.invoke('manage-portfolio', {
        body: { method: 'DELETE', body: { id } },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
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
  }, [user, session, fetchPortfolioHoldings, fetchPortfolioSummary]);

  // Calculate current month savings progress
  const getCurrentMonthSavings = useCallback(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const monthlyEntries = financialEntries.filter(entry => {
      const entryDate = new Date(entry.date);
      return entryDate >= startOfMonth && entryDate <= now;
    });

    const monthlyIncome = monthlyEntries
      .filter(entry => entry.type === 'income')
      .reduce((sum, entry) => sum + entry.amount, 0);

    const monthlyExpenses = monthlyEntries
      .filter(entry => entry.type === 'expense')
      .reduce((sum, entry) => sum + entry.amount, 0);

    const monthlySavings = monthlyEntries
      .filter(entry => entry.type === 'savings')
      .reduce((sum, entry) => sum + entry.amount, 0);

    const netSavings = monthlyIncome - monthlyExpenses + monthlySavings;
    const target = savingsTarget?.monthly_savings_target || 0;
    const progress = target > 0 ? (netSavings / target) * 100 : 0;

    // Calculate days remaining in month
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const daysRemaining = Math.max(0, Math.ceil((endOfMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    
    // Calculate daily savings needed
    const remaining = Math.max(0, target - netSavings);
    const dailyNeeded = daysRemaining > 0 ? remaining / daysRemaining : 0;

    return {
      current: netSavings,
      target,
      progress: Math.min(100, progress),
      remaining,
      daysRemaining,
      dailyNeeded,
      monthlyIncome,
      monthlyExpenses,
      monthlySavings
    };
  }, [financialEntries, savingsTarget]);

  // Initial data fetch
  useEffect(() => {
    if (user && session) {
      fetchFinancialEntries();
      fetchPortfolioHoldings();
      fetchPortfolioSummary();
      fetchInsights();
      fetchSavingsTarget();
    }
  }, [user, session, fetchFinancialEntries, fetchPortfolioHoldings, fetchPortfolioSummary, fetchInsights, fetchSavingsTarget]);

  // Fetch news when holdings change
  useEffect(() => {
    const symbols = portfolioHoldings
      .filter(h => h.symbol && h.asset_type !== 'real_estate')
      .map(h => h.symbol!)
      .slice(0, 10); // Limit to prevent API overload

    if (symbols.length > 0) {
      fetchNews(symbols);
    }
  }, [portfolioHoldings, fetchNews]);

  return {
    // Data
    financialEntries,
    portfolioHoldings,
    portfolioSummary,
    insights,
    news,
    loading,
    savingsTarget,

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

    // Savings target
    updateSavingsTarget,
    fetchSavingsTarget,
    getCurrentMonthSavings,

    // Utilities
    refreshPrices,
    fetchInsights,
    fetchNews
  };
};