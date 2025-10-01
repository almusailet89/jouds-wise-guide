-- Wallets table for guardrails
create table if not exists public.wallets (
  user_id uuid primary key,
  balance numeric(14,2) not null default 0,
  currency text not null default 'SAR',
  updated_at timestamptz not null default now()
);

-- RLS
alter table public.wallets enable row level security;

-- Allow owner to manage their wallet
drop policy if exists "wallets_owner_access" on public.wallets;
create policy "wallets_owner_access"
  on public.wallets
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Realtime
alter publication supabase_realtime add table public.wallets;

-- Helpful index
create index if not exists wallets_user_id_idx on public.wallets(user_id);

-- Function: record_financial_with_wallet
create or replace function public.record_financial_with_wallet(
  _user_id uuid,
  _type text,
  _amount numeric,
  _currency text,
  _category text,
  _description text,
  _occurred_at timestamptz
)
returns table(entry_id uuid, new_balance numeric)
language plpgsql
security definer
as $$
declare
  v_balance numeric;
  v_entry_id uuid;
begin
  if _amount is null or _amount <= 0 then
    raise exception 'INVALID_AMOUNT' using errcode = 'P0001';
  end if;

  -- Ensure wallet row exists
  insert into public.wallets (user_id)
  values (_user_id)
  on conflict (user_id) do nothing;

  if lower(_type) = 'income' then
    update public.wallets
      set balance = balance + _amount,
          updated_at = now()
      where user_id = _user_id
      returning balance into v_balance;
  elsif lower(_type) in ('expense','investment','savings') then
    -- Check sufficient funds
    select balance into v_balance from public.wallets where user_id = _user_id for update;
    if coalesce(v_balance,0) < _amount then
      raise exception 'INSUFFICIENT_BALANCE' using errcode = 'P0001';
    end if;
    update public.wallets
      set balance = balance - _amount,
          updated_at = now()
      where user_id = _user_id
      returning balance into v_balance;
  else
    -- unsupported type
    raise exception 'UNSUPPORTED_TYPE' using errcode = 'P0001';
  end if;

  insert into public.financial_entries (user_id, type, amount, currency, category, description, occurred_at)
  values (_user_id, _type, _amount, coalesce(_currency,'SAR'), _category, _description, coalesce(_occurred_at, now()))
  returning id into v_entry_id;

  entry_id := v_entry_id;
  new_balance := v_balance;
  return next;
end;
$$;

revoke all on function public.record_financial_with_wallet(uuid, text, numeric, text, text, text, timestamptz) from public;
grant execute on function public.record_financial_with_wallet(uuid, text, numeric, text, text, text, timestamptz) to authenticated;
