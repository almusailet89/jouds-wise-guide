-- Reminders, Calendar, Savings Progress, Price Alerts
create extension if not exists pgcrypto;

-- ensure goals table exists
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  target_amount numeric not null default 0,
  created_at timestamptz not null default now()
);

-- scheduled_notifications table
create table if not exists public.scheduled_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  task_id uuid null,
  title text not null,
  body text null,
  scheduled_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','sent','canceled')),
  created_at timestamptz not null default now()
);

alter table public.scheduled_notifications enable row level security;
create policy if not exists scheduled_notifications_select_own on public.scheduled_notifications for select using (auth.uid() = user_id);
create policy if not exists scheduled_notifications_insert_own on public.scheduled_notifications for insert with check (auth.uid() = user_id);
create policy if not exists scheduled_notifications_update_own on public.scheduled_notifications for update using (auth.uid() = user_id);

-- calendar events with RLS
create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (end_at > start_at)
);

alter table public.calendar_events enable row level security;
create policy if not exists calendar_events_select_own on public.calendar_events for select using (auth.uid() = user_id);
create policy if not exists calendar_events_mutate_own on public.calendar_events for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists calendar_events_user_start_idx on public.calendar_events(user_id, start_at);

-- optional helper to detect conflicts
create or replace function public.find_event_conflicts(_user_id uuid, _start timestamptz, _end timestamptz)
returns setof public.calendar_events language sql stable as $$
  select * from public.calendar_events e
  where e.user_id = _user_id
    and tstzrange(e.start_at, e.end_at, '[)') && tstzrange(_start, _end, '[)');
$$;

-- goals progress additions
alter table if exists public.goals
  add column if not exists saved_amount numeric not null default 0,
  add column if not exists target_date date null;

create or replace view public.goals_progress as
select g.id,
       g.user_id,
       g.title,
       g.target_amount,
       g.saved_amount,
       g.target_date,
       greatest(g.target_amount - g.saved_amount, 0)::numeric as remaining,
       case
         when g.target_date is null then null
         when g.target_date::date <= current_date then greatest(g.target_amount - g.saved_amount, 0)::numeric
         else round((greatest(g.target_amount - g.saved_amount, 0)::numeric) / greatest(1, (g.target_date::date - current_date)), 2)
       end as daily_required
from public.goals g;

-- price alerts
create table if not exists public.price_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  holding_id uuid null,
  symbol text not null,
  threshold numeric not null,
  direction text not null check (direction in ('above','below')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  holding_id uuid null,
  symbol text not null,
  price numeric not null,
  direction text not null,
  triggered_at timestamptz not null default now()
);

alter table public.price_alerts enable row level security;
alter table public.alerts enable row level security;
create policy if not exists price_alerts_owner on public.price_alerts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy if not exists alerts_owner on public.alerts for select using (auth.uid() = user_id);

-- function to trigger alerts based on current_price in portfolio_holdings
create or replace function public.trigger_price_alerts(_user_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  cnt int := 0;
  r record;
begin
  for r in
    select pa.id as alert_id, ph.id as holding_id, pa.user_id, pa.symbol, pa.threshold, pa.direction, ph.current_price
    from public.price_alerts pa
    left join public.portfolio_holdings ph on ph.user_id = pa.user_id and ph.symbol = pa.symbol
    where pa.active = true and pa.user_id = _user_id
  loop
    if (case when r.direction = 'above' then r.current_price >= r.threshold else r.current_price <= r.threshold end) then
      insert into public.alerts(user_id, holding_id, symbol, price, direction)
      values (r.user_id, r.holding_id, r.symbol, coalesce(r.current_price, r.threshold), r.direction);
      cnt := cnt + 1;
    end if;
  end loop;
  return cnt;
end;
$$;

revoke execute on function public.trigger_price_alerts(uuid) from public, anon;
grant execute on function public.trigger_price_alerts(uuid) to authenticated;

-- portfolio_holdings price columns for refresh-prices
do $$ begin
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='portfolio_holdings' and column_name='current_price') then
    alter table public.portfolio_holdings add column current_price numeric null;
  end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='portfolio_holdings' and column_name='last_updated') then
    alter table public.portfolio_holdings add column last_updated timestamptz null;
  end if;
end $$;

-- price_history table used by refresh-prices
create table if not exists public.price_history (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  asset_type text not null,
  price numeric not null,
  currency text not null default 'USD',
  recorded_at timestamptz not null default now()
);
