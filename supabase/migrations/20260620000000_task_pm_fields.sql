-- ─── Project Management fields for tasks table ───────────────────────────────
-- Adds: subtasks (parent_task_id), time estimates, task dependencies

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS parent_task_id  UUID        REFERENCES public.tasks(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC(5,1),
  ADD COLUMN IF NOT EXISTS depends_on      TEXT;        -- JSON array of task UUIDs

-- Allow 'in_progress' status for Kanban board
ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_status_check;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_status_check
  CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled'));

-- Index for subtask lookups
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON public.tasks(parent_task_id);

COMMENT ON COLUMN public.tasks.parent_task_id  IS 'Parent task ID — non-null means this is a subtask';
COMMENT ON COLUMN public.tasks.estimated_hours IS 'Estimated hours to complete this task';
COMMENT ON COLUMN public.tasks.depends_on      IS 'JSON array of task UUIDs this task depends on';
