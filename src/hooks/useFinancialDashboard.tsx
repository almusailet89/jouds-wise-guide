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

export const useFinancialDashboard = () => {
  const { user } = useAuth();
  const [financialEntries, setFinancialEntries] = useState<FinancialEntry[]>([]);
  const [portfolioHoldings, setPortfolioHoldings] = useState<PortfolioHolding[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [news, setNews] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(false);
  const [portfolioSummary, setPortfolioSummary] = useState<any>(null);

  // Fetch financial entries
  const fetchFinancialEntries = useCallback(async (range?: string) => {
    if (!user) return;

    try {
      const { data, error } = await supabase.functions.invoke('manage-finance', {
        body: { method: 'GET', body: { range } }
      });

      if (error) throw error;
      setFinancialEntries(data.data || []);
    } catch (error) {
      console.error('Error fetching financial entries:', error);
      toast.error('Failed to fetch financial entries');
    }
  }, [user]);

  // Fetch portfolio holdings
  const fetchPortfolioHoldings = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase.functions.invoke('manage-portfolio', {
        body: { method: 'GET' }
      });

      if (error) throw error;
      setPortfolioHoldings(data.data || []);
    } catch (error) {
      console.error('Error fetching portfolio holdings:', error);
      toast.error('Failed to fetch portfolio holdings');
    }
  }, [user]);

  // Fetch portfolio summary
  const fetchPortfolioSummary = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase.functions.invoke('manage-portfolio', {
        body: { method: 'SUMMARY' }
      });

      if (error) throw error;
      setPortfolioSummary(data.data || {});
    } catch (error) {
      console.error('Error fetching portfolio summary:', error);
    }
  }, [user]);

  // Fetch insights
  const fetchInsights = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase.functions.invoke('get-financial-insights');

      if (error) throw error;
      setInsights(data.insights || []);
    } catch (error) {
      console.error('Error fetching insights:', error);
    }
  }, [user]);

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
    if (!user) return;

    try {
      const { data, error } = await supabase.functions.invoke('manage-finance', {
        body: { method: 'POST', body: entry }
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
  }, [user, fetchFinancialEntries]);

  // Update financial entry
  const updateFinancialEntry = useCallback(async (id: string, updates: Partial<FinancialEntry>) => {
    if (!user) return;

    try {
      const { data, error } = await supabase.functions.invoke('manage-finance', {
        body: { method: 'PATCH', body: { id, updates } }
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
  }, [user, fetchFinancialEntries]);

  // Delete financial entry
  const deleteFinancialEntry = useCallback(async (id: string) => {
    if (!user) return;

    try {
      const { error } = await supabase.functions.invoke('manage-finance', {
        body: { method: 'DELETE', body: { id } }
      });

      if (error) throw error;
      
      toast.success('Entry deleted');
      await fetchFinancialEntries();
    } catch (error) {
      console.error('Error deleting financial entry:', error);
      toast.error('Failed to delete entry');
      throw error;
    }
  }, [user, fetchFinancialEntries]);

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
      fetchFinancialEntries();
      fetchPortfolioHoldings();
      fetchPortfolioSummary();
      fetchInsights();
    }
  }, [user, fetchFinancialEntries, fetchPortfolioHoldings, fetchPortfolioSummary, fetchInsights]);

  // Fetch news when holdings change
  useEffect(() => {
    const symbols = portfolioHoldings
      .filter(h => h.symbol)
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

    // Utilities
    refreshPrices,
    fetchInsights,
    fetchNews
  };
};