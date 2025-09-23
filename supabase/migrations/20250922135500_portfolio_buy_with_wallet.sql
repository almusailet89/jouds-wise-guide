-- Portfolio buy with wallet guardrails (atomic)
create or replace function public.record_portfolio_buy_with_wallet(
  _user_id uuid,
  _symbol text,
  _quantity numeric,
  _price numeric,
  _currency text default 'SAR'
)
returns table(holding_id uuid, new_balance numeric)
language plpgsql
security definer
as $$
declare
  v_balance numeric;
  v_cost numeric;
  v_holding_id uuid;
begin
  if _quantity is null or _quantity <= 0 then
    raise exception 'INVALID_QUANTITY' using errcode = 'P0001';
  end if;
  if _price is null or _price <= 0 then
    raise exception 'INVALID_PRICE' using errcode = 'P0001';
  end if;
  if coalesce(_symbol, '') = '' then
    raise exception 'INVALID_SYMBOL' using errcode = 'P0001';
  end if;

  -- Ensure wallet row exists
  insert into public.wallets (user_id)
  values (_user_id)
  on conflict (user_id) do nothing;

  v_cost := _quantity * _price;
  select balance into v_balance from public.wallets where user_id = _user_id for update;
  if coalesce(v_balance,0) < v_cost then
    raise exception 'INSUFFICIENT_FUNDS' using errcode = 'P0001';
  end if;

  -- Deduct wallet
  update public.wallets
    set balance = balance - v_cost,
        updated_at = now()
    where user_id = _user_id
    returning balance into v_balance;

  -- Insert holding lot
  insert into public.portfolio_holdings (user_id, asset_type, symbol, quantity, avg_price, currency, market, created_at)
  values (_user_id, 'stock', upper(_symbol), _quantity, _price, coalesce(_currency,'SAR'), 'US', now())
  returning id into v_holding_id;

  holding_id := v_holding_id;
  new_balance := v_balance;
  return next;
end;
$$;

revoke all on function public.record_portfolio_buy_with_wallet(uuid, text, numeric, numeric, text) from public;
grant execute on function public.record_portfolio_buy_with_wallet(uuid, text, numeric, numeric, text) to authenticated;
