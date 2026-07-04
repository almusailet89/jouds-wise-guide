-- Add timezone preference columns to profiles
-- Default: Asia/Riyadh (Saudi Arabia Standard Time, UTC+3)
-- timezone_auto: when true, the client uses the browser's detected timezone

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS timezone      TEXT    DEFAULT 'Asia/Riyadh',
  ADD COLUMN IF NOT EXISTS timezone_auto BOOLEAN DEFAULT false;
