-- Fix the portfolio summary function to avoid nested aggregate errors
DROP FUNCTION IF EXISTS public.get_portfolio_summary(uuid);

CREATE OR REPLACE FUNCTION public.get_portfolio_summary(user_uuid uuid)
RETURNS TABLE(
  total_value numeric, 
  total_cost numeric, 
  total_pnl numeric, 
  total_pnl_percent numeric, 
  asset_allocation jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  portfolio_record RECORD;
  allocation_record RECORD;
  allocation_data jsonb := '{}';
BEGIN
  -- Get portfolio totals
  SELECT 
    COALESCE(SUM(
      CASE WHEN ph.quantity IS NOT NULL AND ph.avg_price IS NOT NULL 
      THEN ph.quantity * COALESCE(ph.current_price, ph.avg_price, 0) 
      ELSE COALESCE(ph.purchase_price, 0) END
    ), 0) as total_val,
    COALESCE(SUM(
      CASE WHEN ph.quantity IS NOT NULL AND ph.avg_price IS NOT NULL 
      THEN ph.quantity * ph.avg_price 
      ELSE COALESCE(ph.purchase_price, 0) END
    ), 0) as total_cost_basis
  INTO portfolio_record
  FROM portfolio_holdings ph
  WHERE ph.user_id = user_uuid;

  -- Calculate allocation percentages
  IF portfolio_record.total_val > 0 THEN
    FOR allocation_record IN 
      SELECT 
        ph.asset_type,
        SUM(
          CASE WHEN ph.quantity IS NOT NULL AND ph.avg_price IS NOT NULL 
          THEN ph.quantity * COALESCE(ph.current_price, ph.avg_price, 0) 
          ELSE COALESCE(ph.purchase_price, 0) END
        ) as type_value
      FROM portfolio_holdings ph
      WHERE ph.user_id = user_uuid
      GROUP BY ph.asset_type
    LOOP
      allocation_data := allocation_data || 
        jsonb_build_object(
          allocation_record.asset_type, 
          ROUND((allocation_record.type_value / portfolio_record.total_val * 100)::numeric, 2)
        );
    END LOOP;
  END IF;

  -- Return the results
  total_value := portfolio_record.total_val;
  total_cost := portfolio_record.total_cost_basis;
  total_pnl := portfolio_record.total_val - portfolio_record.total_cost_basis;
  
  IF portfolio_record.total_cost_basis > 0 THEN
    total_pnl_percent := ROUND(((portfolio_record.total_val - portfolio_record.total_cost_basis) / portfolio_record.total_cost_basis * 100)::numeric, 2);
  ELSE
    total_pnl_percent := 0;
  END IF;
  
  asset_allocation := allocation_data;

  RETURN NEXT;
END;
$$;