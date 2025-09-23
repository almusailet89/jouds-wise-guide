-- Savings contributions table and atomic RPC for wallet-safe contributions

-- Table
create table if not exists public.savings_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid null references public.goals(id) on delete set null,
  financial_entry_id uuid null references public.financial_entries(id) on delete set null,
  amount_sar numeric(12,2) not null check (amount_sar > 0),
  note text null,
  created_at timestamptz not null default now()
);

-- RLS
alter table public.savings_contributions enable row level security;
drop policy if exists "savings_contributions_owner_all" on public.savings_contributions;
create policy "savings_contributions_owner_all"
  on public.savings_contributions
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Helpful indexes
create index if not exists savings_contributions_user_id_idx on public.savings_contributions(user_id);
create index if not exists savings_contributions_goal_id_idx on public.savings_contributions(goal_id);

-- RPC: record_savings_contribution
create or replace function public.record_savings_contribution(
  _user_id uuid,
  _amount_sar numeric,
  _goal_id uuid default null,
  _note text default null
)
returns table(contribution_id uuid, financial_entry_id uuid, new_balance numeric)
language plpgsql
security definer
as $$
declare
  v_balance numeric;
  v_contribution_id uuid;
  v_entry_id uuid;
begin
  -- caller must be the owner
  if _user_id is distinct from auth.uid() then
    raise exception 'NOT_OWNER' using errcode = 'P0001';
  end if;

  if _amount_sar is null or _amount_sar <= 0 then
    raise exception 'INVALID_AMOUNT' using errcode = 'P0001';
  end if;

  -- Ensure wallet row exists
  insert into public.wallets (user_id)
  values (_user_id)
  on conflict (user_id) do nothing;

  -- Sufficient funds check with lock
  select balance into v_balance from public.wallets where user_id = _user_id for update;
  if coalesce(v_balance,0) < _amount_sar then
    raise exception 'INSUFFICIENT_FUNDS' using errcode = 'P0001';
  end if;

  -- Deduct from wallet
  update public.wallets
    set balance = balance - _amount_sar,
        updated_at = now()
    where user_id = _user_id
    returning balance into v_balance;

  -- Insert financial entry (savings)
  insert into public.financial_entries (user_id, type, amount, currency, category, description, occurred_at)
  values (_user_id, 'savings', _amount_sar, 'SAR', 'savings', _note, now())
  returning id into v_entry_id;

  -- Insert contribution row
  insert into public.savings_contributions (user_id, goal_id, financial_entry_id, amount_sar, note)
  values (_user_id, _goal_id, v_entry_id, _amount_sar, _note)
  returning id into v_contribution_id;

  -- Optionally update profile aggregates if your schema has them
  -- update public.profiles set monthly_savings_actual = coalesce(monthly_savings_actual,0) + _amount_sar where user_id = _user_id;

  contribution_id := v_contribution_id;
  financial_entry_id := v_entry_id;
  new_balance := v_balance;
  return next;
end;
$$;

revoke all on function public.record_savings_contribution(uuid, numeric, uuid, text) from public;
grant execute on function public.record_savings_contribution(uuid, numeric, uuid, text) to authenticated;
