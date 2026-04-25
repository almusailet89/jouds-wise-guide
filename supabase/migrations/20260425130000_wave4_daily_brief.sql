-- ════════════════════════════════════════════════════════════════════════════
-- Wave 4 P3 — Daily Brief
--
-- Personalized morning greeting that ties together memories, finances,
-- prayer times, today's events, and Saudi context into a luxury
-- executive-assistant brief. One brief per user per day.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.daily_briefs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- One brief per user per day (Riyadh timezone)
  brief_date      date NOT NULL,

  -- Content
  greeting        text NOT NULL,                  -- "صباح الخير، فاطمة"
  content         text NOT NULL,                  -- Full brief body
  highlights      jsonb DEFAULT '[]'::jsonb,      -- Array of {kind, text, action}
  suggested_action text,                          -- Optional CTA

  -- Generation context (for debugging + iteration)
  meta            jsonb DEFAULT '{}'::jsonb,      -- {memories_used, model, tokens, ...}

  -- Lifecycle
  read_at         timestamptz,
  spoken_at       timestamptz,                    -- when user tapped "Listen"
  dismissed_at    timestamptz,

  created_at      timestamptz DEFAULT now(),

  CONSTRAINT daily_briefs_unique_per_day UNIQUE (user_id, brief_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_briefs_user_date
  ON public.daily_briefs(user_id, brief_date DESC);

ALTER TABLE public.daily_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own briefs"
  ON public.daily_briefs FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own briefs"
  ON public.daily_briefs FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own briefs"
  ON public.daily_briefs FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users delete own briefs"
  ON public.daily_briefs FOR DELETE USING (auth.uid() = user_id);
