-- Fix the function search path security issue
CREATE OR REPLACE FUNCTION check_max_holdings()
RETURNS trigger AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.portfolio_holdings WHERE user_id = NEW.user_id) >= 25 THEN
    RAISE EXCEPTION 'Maximum of 25 holdings allowed per user';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;