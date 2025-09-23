-- Add saved_amount to goals for savings progress tracking
alter table if exists public.goals
  add column if not exists saved_amount numeric(14,2) not null default 0;

-- Optional helpful index for frequent lookups by user
create index if not exists goals_user_id_idx on public.goals(user_id);
