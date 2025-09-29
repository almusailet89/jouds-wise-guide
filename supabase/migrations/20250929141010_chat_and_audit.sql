-- chat_messages and wallet_audit_log
-- Ensure required extensions
create extension if not exists pgcrypto;

-- chat_messages table
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  conversation_id uuid null,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.chat_messages enable row level security;

-- Policies: owner-only
create policy if not exists chat_messages_select_own on public.chat_messages for select
  using (auth.uid() = user_id);
create policy if not exists chat_messages_insert_own on public.chat_messages for insert
  with check (auth.uid() = user_id);
create policy if not exists chat_messages_delete_own on public.chat_messages for delete
  using (auth.uid() = user_id);

-- wallet_audit_log table for manual adjustments and overdrafts
create table if not exists public.wallet_audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  delta_sar numeric not null,
  reason text not null,
  confirmed_phrase text null,
  metadata jsonb null,
  created_at timestamptz not null default now()
);

alter table public.wallet_audit_log enable row level security;

create policy if not exists wallet_audit_select_own on public.wallet_audit_log for select
  using (auth.uid() = user_id);
create policy if not exists wallet_audit_insert_own on public.wallet_audit_log for insert
  with check (auth.uid() = user_id);
