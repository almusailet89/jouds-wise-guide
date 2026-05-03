-- ═══════════════════════════════════════════════════════════════════════════
-- P0 Fixes Migration — idempotent (safe to re-run)
--
-- Fixes six silent failures:
--   1. goals table missing entirely  → add_goal / update_goal / delete_goal crash
--   2. habits missing columns        → is_active, target_days, time_of_day
--   3. events missing alias columns  → start_at, end_at (edge fn writes both)
--   4. user_memories missing columns → category, is_template
--   5. get_memory_taxonomy RPC       → missing; returns wrong field names
--   6. profiles missing columns      → working_days, weekend_days, onboarding_done
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Goals table ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.goals (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  target_amount  NUMERIC(14,2) NOT NULL DEFAULT 0,
  saved_amount   NUMERIC(14,2) NOT NULL DEFAULT 0,
  target_date    DATE,
  status         TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active','completed','cancelled')),
  icon           TEXT DEFAULT '🎯',
  color          TEXT DEFAULT '#0E4E4E',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_goals_user
  ON public.goals(user_id, created_at DESC);

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "goals_own" ON public.goals;
CREATE POLICY "goals_own" ON public.goals
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.tg_goals_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS goals_updated_at ON public.goals;
CREATE TRIGGER goals_updated_at
  BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.tg_goals_updated_at();

-- ─── 2. Habits — add missing columns ─────────────────────────────────────────
ALTER TABLE public.habits
  ADD COLUMN IF NOT EXISTS is_active   BOOLEAN   NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS target_days INTEGER[],   -- weekday indices 0=Sun..6=Sat
  ADD COLUMN IF NOT EXISTS time_of_day TEXT;         -- HH:MM 24h format

-- ─── 3. Events — add start_at / end_at alias columns ─────────────────────────
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_at   TIMESTAMPTZ;

UPDATE public.events
  SET start_at = starts_at, end_at = ends_at
  WHERE start_at IS NULL AND starts_at IS NOT NULL;

-- ─── 4. user_memories — add missing category + is_template columns ───────────
ALTER TABLE public.user_memories
  ADD COLUMN IF NOT EXISTS category    TEXT CHECK (category IN (
    'identity','work','family','financial','health','religion',
    'routine','goals','interests','relationships','preferences','pain_points'
  )),
  ADD COLUMN IF NOT EXISTS is_template BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_user_memories_category
  ON public.user_memories(user_id, category);

-- ─── 5. get_memory_taxonomy RPC ──────────────────────────────────────────────
-- Returns one row per category (all 12), with filled_count and latest_real_content.
-- Edge function expects: category TEXT, filled_count BIGINT, latest_real_content TEXT
CREATE OR REPLACE FUNCTION public.get_memory_taxonomy(p_user_id UUID)
RETURNS TABLE (
  category             TEXT,
  filled_count         BIGINT,
  latest_real_content  TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH all_cats(cat) AS (
    VALUES
      ('identity'),('work'),('family'),('financial'),('health'),('religion'),
      ('routine'),('goals'),('interests'),('relationships'),('preferences'),('pain_points')
  ),
  mem_agg AS (
    SELECT
      category,
      COUNT(*)                                          AS filled_count,
      (ARRAY_AGG(content ORDER BY created_at DESC))[1] AS latest_real_content
    FROM public.user_memories
    WHERE user_id   = p_user_id
      AND active    = true
      AND (expires_at IS NULL OR expires_at > now())
      AND is_template = false
    GROUP BY category
  )
  SELECT
    ac.cat         AS category,
    COALESCE(ma.filled_count, 0)         AS filled_count,
    ma.latest_real_content
  FROM all_cats ac
  LEFT JOIN mem_agg ma ON ma.category = ac.cat
  ORDER BY ac.cat;
$$;

-- ─── 6. Profiles — add missing columns ───────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS working_days    INTEGER[] DEFAULT '{0,1,2,3,4}',   -- Sun–Thu
  ADD COLUMN IF NOT EXISTS weekend_days    INTEGER[] DEFAULT '{5,6}',           -- Fri–Sat
  ADD COLUMN IF NOT EXISTS onboarding_done BOOLEAN   NOT NULL DEFAULT false;

-- ─── Comments ─────────────────────────────────────────────────────────────────
COMMENT ON TABLE  public.goals IS 'Savings/financial goals created by user or Jood AI';
COMMENT ON COLUMN public.habits.is_active        IS 'false = paused, not deleted';
COMMENT ON COLUMN public.habits.target_days      IS 'Weekly habit day indices (0=Sun…6=Sat)';
COMMENT ON COLUMN public.habits.time_of_day      IS 'Reminder time HH:MM 24h';
COMMENT ON COLUMN public.events.start_at         IS 'Alias for starts_at (edge fn compat)';
COMMENT ON COLUMN public.events.end_at           IS 'Alias for ends_at (edge fn compat)';
COMMENT ON COLUMN public.user_memories.category  IS '12-category life-area taxonomy';
COMMENT ON COLUMN public.user_memories.is_template IS 'True = seeded template, not real user data';
COMMENT ON COLUMN public.profiles.working_days   IS 'Weekday indices the user works (0=Sun)';
COMMENT ON COLUMN public.profiles.weekend_days   IS 'Weekday indices that are weekend';
COMMENT ON COLUMN public.profiles.onboarding_done IS 'Persists onboarding completion across devices';
