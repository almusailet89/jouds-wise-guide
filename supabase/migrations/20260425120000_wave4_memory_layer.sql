-- ════════════════════════════════════════════════════════════════════════════
-- Wave 4 P2 — Sophisticated Memory Layer
--
-- Lets Jood remember facts, preferences, goals, and patterns about each user
-- across sessions. Memories are extracted automatically from conversation and
-- injected back into the GPT system prompt on subsequent turns.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── user_memories ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_memories (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Classification
  kind            text NOT NULL CHECK (kind IN (
    'fact',          -- "I have 3 kids", "I work at Aramco"
    'preference',    -- "I like halal investments", "I prefer Arabic UI"
    'goal',          -- "Save 100k SAR for Hajj by 2027"
    'pattern',       -- "Usually buys coffee at 7am", "Trades on Sundays"
    'relationship',  -- "Wife: Layla", "Manager: Khalid"
    'context'        -- "Lives in Riyadh", "Drives a Lexus"
  )),

  -- The memory itself (free-form Arabic/English)
  content         text NOT NULL,

  -- Optional structured payload — e.g., {"amount": 100000, "currency": "SAR", "deadline": "2027-12-31"}
  metadata        jsonb DEFAULT '{}'::jsonb,

  -- Confidence + importance scoring (0..1) — helps prioritize injection
  confidence      real DEFAULT 0.7 CHECK (confidence >= 0 AND confidence <= 1),
  importance      real DEFAULT 0.5 CHECK (importance >= 0 AND importance <= 1),

  -- Provenance
  source_message_id  uuid REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  source_session_id  uuid REFERENCES public.chat_sessions(id) ON DELETE SET NULL,

  -- Lifecycle
  active          boolean DEFAULT true,
  expires_at      timestamptz,    -- NULL = permanent
  last_used_at    timestamptz,    -- updated when memory is referenced in a prompt
  use_count       integer DEFAULT 0,

  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_memories_user
  ON public.user_memories(user_id, active, importance DESC);

CREATE INDEX IF NOT EXISTS idx_user_memories_kind
  ON public.user_memories(user_id, kind);

CREATE INDEX IF NOT EXISTS idx_user_memories_recency
  ON public.user_memories(user_id, last_used_at DESC NULLS LAST);

-- ─── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.user_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own memories"
  ON public.user_memories FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own memories"
  ON public.user_memories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own memories"
  ON public.user_memories FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own memories"
  ON public.user_memories FOR DELETE
  USING (auth.uid() = user_id);

-- ─── updated_at trigger ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.tg_user_memories_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS user_memories_updated_at ON public.user_memories;
CREATE TRIGGER user_memories_updated_at
  BEFORE UPDATE ON public.user_memories
  FOR EACH ROW EXECUTE FUNCTION public.tg_user_memories_updated_at();

-- ─── Helper: top N most-relevant memories for prompt injection ──────────────
CREATE OR REPLACE FUNCTION public.get_user_memories_for_prompt(
  p_user_id uuid,
  p_limit   integer DEFAULT 12
)
RETURNS TABLE (
  id          uuid,
  kind        text,
  content     text,
  metadata    jsonb,
  importance  real,
  confidence  real
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT id, kind, content, metadata, importance, confidence
  FROM public.user_memories
  WHERE user_id = p_user_id
    AND active = true
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY
    importance * confidence DESC,
    last_used_at DESC NULLS LAST,
    created_at DESC
  LIMIT p_limit;
$$;

-- ─── Helper: bump use_count + last_used_at when memory is referenced ────────
CREATE OR REPLACE FUNCTION public.touch_user_memories(
  p_memory_ids uuid[]
)
RETURNS void
LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.user_memories
  SET last_used_at = now(),
      use_count    = use_count + 1
  WHERE id = ANY(p_memory_ids);
$$;
