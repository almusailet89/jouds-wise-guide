-- Monthly voice-minute tracking for Majlis (Gemini Live and ElevenLabs).
-- The gemini-live-token edge function reads this before issuing a session token;
-- the app reports elapsed call time through record_voice_usage().

create table if not exists public.voice_usage (
  user_id      uuid not null references auth.users(id) on delete cascade,
  period_month date not null,
  seconds_used integer not null default 0 check (seconds_used >= 0),
  sessions     integer not null default 0 check (sessions >= 0),
  engine_seconds jsonb not null default '{}'::jsonb,
  updated_at   timestamptz not null default now(),
  primary key (user_id, period_month)
);

alter table public.voice_usage enable row level security;

drop policy if exists "voice_usage_select_own" on public.voice_usage;
create policy "voice_usage_select_own" on public.voice_usage
  for select to authenticated using (auth.uid() = user_id);

-- Writes go only through the function below (no insert/update policies).

create or replace function public.record_voice_usage(
  p_seconds integer,
  p_engine text default 'gemini',
  p_new_session boolean default false
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_seconds integer := greatest(0, least(coalesce(p_seconds, 0), 120)); -- one heartbeat covers at most 2 minutes
  v_engine text := case when p_engine in ('gemini', 'elevenlabs') then p_engine else 'gemini' end;
  v_month date := date_trunc('month', now() at time zone 'utc')::date;
  v_total integer;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  insert into public.voice_usage as vu (user_id, period_month, seconds_used, sessions, engine_seconds, updated_at)
  values (
    v_uid, v_month, v_seconds, case when p_new_session then 1 else 0 end,
    jsonb_build_object(v_engine, v_seconds), now()
  )
  on conflict (user_id, period_month) do update
    set seconds_used = vu.seconds_used + v_seconds,
        sessions = vu.sessions + case when p_new_session then 1 else 0 end,
        engine_seconds = vu.engine_seconds || jsonb_build_object(
          v_engine, coalesce((vu.engine_seconds ->> v_engine)::integer, 0) + v_seconds
        ),
        updated_at = now()
  returning seconds_used into v_total;

  return v_total;
end;
$$;

revoke all on function public.record_voice_usage(integer, text, boolean) from public, anon;
grant execute on function public.record_voice_usage(integer, text, boolean) to authenticated;
