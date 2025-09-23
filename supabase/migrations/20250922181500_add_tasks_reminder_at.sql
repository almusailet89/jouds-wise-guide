-- Add reminder_at to tasks if missing
alter table if exists public.tasks
  add column if not exists reminder_at timestamptz null;
