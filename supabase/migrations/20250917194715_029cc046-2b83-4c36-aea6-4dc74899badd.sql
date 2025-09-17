-- Enhance portfolio_holdings table
ALTER TABLE public.portfolio_holdings 
ADD COLUMN IF NOT EXISTS asset_type TEXT CHECK (asset_type IN ('stock', 'crypto', 'real_estate')) DEFAULT 'stock',
ADD COLUMN IF NOT EXISTS current_price NUMERIC,
ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS property_type TEXT,
ADD COLUMN IF NOT EXISTS sqft NUMERIC,
ADD COLUMN IF NOT EXISTS purchase_price NUMERIC;

-- Create price_history table
CREATE TABLE IF NOT EXISTS public.price_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  symbol TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('stock', 'crypto', 'real_estate')),
  price NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on price_history
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;

-- Create policies for price_history
CREATE POLICY "Users can view price history" 
ON public.price_history 
FOR SELECT 
USING (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "Users can insert price history" 
ON public.price_history 
FOR INSERT 
WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

-- Add constraint for max 25 holdings per user
CREATE OR REPLACE FUNCTION check_max_holdings()
RETURNS trigger AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.portfolio_holdings WHERE user_id = NEW.user_id) >= 25 THEN
    RAISE EXCEPTION 'Maximum of 25 holdings allowed per user';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_max_holdings ON public.portfolio_holdings;
CREATE TRIGGER enforce_max_holdings
  BEFORE INSERT ON public.portfolio_holdings
  FOR EACH ROW EXECUTE FUNCTION check_max_holdings();

-- Update financial_data table to ensure it has all needed columns
ALTER TABLE public.financial_data 
ADD COLUMN IF NOT EXISTS date TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_price_history_symbol_timestamp ON public.price_history(symbol, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_portfolio_holdings_user_asset_type ON public.portfolio_holdings(user_id, asset_type);