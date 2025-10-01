-- Create news_cache table for storing financial news
CREATE TABLE IF NOT EXISTS public.news_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL,
  title TEXT NOT NULL,
  source TEXT NOT NULL,
  url TEXT NOT NULL,
  published_at TIMESTAMP WITH TIME ZONE NOT NULL,
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  content TEXT,
  sentiment NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on news_cache
ALTER TABLE public.news_cache ENABLE ROW LEVEL SECURITY;

-- Create policy for news_cache (public read access for efficiency)
CREATE POLICY "Anyone can read news cache" 
ON public.news_cache 
FOR SELECT 
USING (true);

-- Update financial_data table structure to match requirements
ALTER TABLE public.financial_data 
ADD COLUMN IF NOT EXISTS description TEXT;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_news_cache_symbol ON public.news_cache(symbol);
CREATE INDEX IF NOT EXISTS idx_news_cache_published_at ON public.news_cache(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_portfolio_holdings_user_symbol ON public.portfolio_holdings(user_id, symbol);
CREATE INDEX IF NOT EXISTS idx_price_history_symbol_timestamp ON public.price_history(symbol, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_financial_data_user_date ON public.financial_data(user_id, date DESC);

-- Create function to refresh portfolio summary
CREATE OR REPLACE FUNCTION public.get_portfolio_summary(user_uuid UUID)
RETURNS TABLE(
  total_value NUMERIC,
  total_cost NUMERIC,
  total_pnl NUMERIC,
  total_pnl_percent NUMERIC,
  asset_allocation JSONB
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH portfolio_stats AS (
    SELECT 
      ph.asset_type,
      ph.symbol,
      ph.quantity,
      ph.avg_price,
      COALESCE(ph.current_price, ph.avg_price) as current_price,
      ph.quantity * ph.avg_price as cost_basis,
      ph.quantity * COALESCE(ph.current_price, ph.avg_price) as current_value
    FROM public.portfolio_holdings ph
    WHERE ph.user_id = user_uuid
  ),
  totals AS (
    SELECT 
      SUM(current_value) as total_val,
      SUM(cost_basis) as total_cost_basis,
      SUM(current_value - cost_basis) as total_profit_loss
    FROM portfolio_stats
  ),
  allocations AS (
    SELECT 
      jsonb_object_agg(
        asset_type, 
        ROUND((SUM(current_value) / (SELECT total_val FROM totals) * 100)::numeric, 2)
      ) as allocation_data
    FROM portfolio_stats
    GROUP BY asset_type
  )
  SELECT 
    t.total_val,
    t.total_cost_basis,
    t.total_profit_loss,
    CASE 
      WHEN t.total_cost_basis > 0 
      THEN ROUND((t.total_profit_loss / t.total_cost_basis * 100)::numeric, 2)
      ELSE 0
    END,
    COALESCE(a.allocation_data, '{}'::jsonb)
  FROM totals t
  CROSS JOIN allocations a;
END;
$$;