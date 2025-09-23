-- Create unified tables and RLS for Joud Dual-Brain Model
-- This migration creates financial_entries, goals, and knowledge_vault
-- and adds them to the realtime publication.

-- Extensions for UUID generation
create extension if not exists "pgcrypto";

-- financial_entries
create table if not exists public.financial_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('income','expense','savings')),
  amount numeric not null check (amount > 0),
  currency text not null,
  category text,
  description text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.financial_entries enable row level security;

-- Policies: user can CRUD only their rows
drop policy if exists "fin_entries_select_own" on public.financial_entries;
create policy "fin_entries_select_own" on public.financial_entries
  for select using (auth.uid() = user_id);
drop policy if exists "fin_entries_insert_own" on public.financial_entries;
create policy "fin_entries_insert_own" on public.financial_entries
  for insert with check (auth.uid() = user_id);
drop policy if exists "fin_entries_update_own" on public.financial_entries;
create policy "fin_entries_update_own" on public.financial_entries
  for update using (auth.uid() = user_id);
drop policy if exists "fin_entries_delete_own" on public.financial_entries;
create policy "fin_entries_delete_own" on public.financial_entries
  for delete using (auth.uid() = user_id);

create index if not exists fin_entries_user_occurred_idx on public.financial_entries(user_id, occurred_at desc);

-- goals
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  notes text,
  target_date date,
  amount_target numeric,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.goals enable row level security;

drop policy if exists "goals_select_own" on public.goals;
create policy "goals_select_own" on public.goals
  for select using (auth.uid() = user_id);
drop policy if exists "goals_insert_own" on public.goals;
create policy "goals_insert_own" on public.goals
  for insert with check (auth.uid() = user_id);
drop policy if exists "goals_update_own" on public.goals;
create policy "goals_update_own" on public.goals
  for update using (auth.uid() = user_id);
drop policy if exists "goals_delete_own" on public.goals;
create policy "goals_delete_own" on public.goals
  for delete using (auth.uid() = user_id);

create index if not exists goals_user_created_idx on public.goals(user_id, created_at desc);

-- knowledge_vault
create table if not exists public.knowledge_vault (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  content text,
  tags text[] default '{}',
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.knowledge_vault enable row level security;

drop policy if exists "kv_select_own" on public.knowledge_vault;
create policy "kv_select_own" on public.knowledge_vault
  for select using (auth.uid() = user_id);
drop policy if exists "kv_insert_own" on public.knowledge_vault;
create policy "kv_insert_own" on public.knowledge_vault
  for insert with check (auth.uid() = user_id);
drop policy if exists "kv_update_own" on public.knowledge_vault;
create policy "kv_update_own" on public.knowledge_vault
  for update using (auth.uid() = user_id);
drop policy if exists "kv_delete_own" on public.knowledge_vault;
create policy "kv_delete_own" on public.knowledge_vault
  for delete using (auth.uid() = user_id);

create index if not exists kv_user_created_idx on public.knowledge_vault(user_id, created_at desc);

-- Add to realtime publication
alter publication supabase_realtime add table public.financial_entries;
alter publication supabase_realtime add table public.goals;
alter publication supabase_realtime add table public.knowledge_vault;
