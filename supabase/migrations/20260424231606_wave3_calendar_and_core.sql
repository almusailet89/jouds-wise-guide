-- ═══════════════════════════════════════════════════════════════════════════
-- Wave 3 Migration — Core tables referenced by app (Wave 2 + Wave 3)
-- Idempotent: safe to re-run. Adds chat persistence, habits, recommendations,
-- and the Smart Calendar events table.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Chat Sessions / Messages (Wave 2) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT 'محادثة جديدة',
  summary     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user
  ON public.chat_sessions(user_id, updated_at DESC);

ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_sessions_own" ON public.chat_sessions;
CREATE POLICY "chat_sessions_own" ON public.chat_sessions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content     TEXT NOT NULL,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session
  ON public.chat_messages(session_id, created_at ASC);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_messages_own" ON public.chat_messages;
CREATE POLICY "chat_messages_own" ON public.chat_messages
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ─── Habits (Wave 2) ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.habits (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  icon        TEXT,
  color       TEXT,
  frequency   TEXT NOT NULL DEFAULT 'daily',
  target      INT DEFAULT 1,
  archived_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_habits_user ON public.habits(user_id, created_at DESC);
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "habits_own" ON public.habits;
CREATE POLICY "habits_own" ON public.habits
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.habit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id        UUID NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  completed_date  DATE NOT NULL,
  count           INT DEFAULT 1,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (habit_id, completed_date)
);

CREATE INDEX IF NOT EXISTS idx_habit_logs_user_date
  ON public.habit_logs(user_id, completed_date DESC);

ALTER TABLE public.habit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "habit_logs_own" ON public.habit_logs;
CREATE POLICY "habit_logs_own" ON public.habit_logs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ─── AI Recommendations (Wave 2/3) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_recommendations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL,           -- 'finance' | 'health' | 'planning' | 'spiritual'
  title        TEXT NOT NULL,
  body         TEXT,
  cta_label    TEXT,
  cta_target   TEXT,                    -- tab or route
  confidence   NUMERIC(3,2),            -- 0.00..1.00
  priority     INT DEFAULT 0,
  dismissed_at TIMESTAMPTZ,
  acted_at     TIMESTAMPTZ,
  metadata     JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_rec_user_active
  ON public.ai_recommendations(user_id, created_at DESC)
  WHERE dismissed_at IS NULL;

ALTER TABLE public.ai_recommendations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ai_rec_own" ON public.ai_recommendations;
CREATE POLICY "ai_rec_own" ON public.ai_recommendations
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ─── Calendar Events (Wave 3) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  starts_at     TIMESTAMPTZ NOT NULL,
  ends_at       TIMESTAMPTZ,
  all_day       BOOLEAN NOT NULL DEFAULT FALSE,
  category      TEXT DEFAULT 'personal',     -- personal/finance/health/prayer/family
  color         TEXT,
  location      TEXT,
  recurrence    TEXT,                        -- 'daily','weekly','monthly','yearly', null
  recurrence_rule JSONB,                     -- {byday:['FR'], interval:1, until:'2026-01-01'}
  hijri_anchor  BOOLEAN NOT NULL DEFAULT FALSE,  -- recur on Hijri calendar
  reminder_min  INT,                         -- minutes before start
  prayer_linked TEXT,                        -- 'fajr','dhuhr','asr','maghrib','isha'
  source        TEXT DEFAULT 'user',         -- user/ai/nlu
  completed_at  TIMESTAMPTZ,
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_user_start
  ON public.events(user_id, starts_at ASC);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "events_own" ON public.events;
CREATE POLICY "events_own" ON public.events
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ─── updated_at triggers ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS chat_sessions_updated_at ON public.chat_sessions;
CREATE TRIGGER chat_sessions_updated_at BEFORE UPDATE ON public.chat_sessions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS habits_updated_at ON public.habits;
CREATE TRIGGER habits_updated_at BEFORE UPDATE ON public.habits
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS events_updated_at ON public.events;
CREATE TRIGGER events_updated_at BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
