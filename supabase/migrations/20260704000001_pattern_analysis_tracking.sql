-- Track when pattern inference last ran per user so analyze-patterns
-- can gate itself without a session count query every time.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_pattern_analysis_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pattern_analysis_session_count INTEGER DEFAULT 0;

COMMENT ON COLUMN public.profiles.last_pattern_analysis_at
  IS 'Timestamp of the last time analyze-patterns ran for this user';
COMMENT ON COLUMN public.profiles.pattern_analysis_session_count
  IS 'chat_sessions.count at the time of the last pattern analysis run';
