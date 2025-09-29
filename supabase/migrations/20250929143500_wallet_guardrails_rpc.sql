-- Wallet guardrail RPC compatible with 8083 schema (financial_data based)
create extension if not exists pgcrypto;

-- record_financial_with_wallet_profile
-- Enforces auth.uid() = _user_id, prevents negative net unless explicitly allowed with confirmation phrase.
-- Returns JSON: { ok: true, new_balance: numeric }
create or replace function public.record_financial_with_wallet_profile(
  _user_id uuid,
  _type text,
  _amount numeric,
  _note text default null,
  _occurred_at timestamptz default now(),
  _allow_overdraft boolean default false,
  _confirmation_phrase text default null
) returns json
language plpgsql
security definer
set search_path = public as $$
declare
  net_before numeric := 0;
  net_after numeric := 0;
  debit boolean := false;
begin
  if auth.uid() is null or auth.uid() <> _user_id then
    raise exception 'uid_mismatch' using errcode = '28000';
  end if;

  if _type not in ('income','expense','investment','savings') then
    raise exception 'invalid_type';
  end if;

  -- compute net balance before write: (income+savings) - (expense+investment)
  select coalesce(sum(case when type in ('income','savings') then amount when type in ('expense','investment') then -amount else 0 end), 0)
    into net_before
  from public.financial_data
  where user_id = _user_id;

  debit := _type in ('expense','investment');
  if debit and (net_before - _amount < 0) then
    if not _allow_overdraft or coalesce(length(trim(_confirmation_phrase)) < 8, true) then
      raise exception 'insufficient_wallet_balance' using errcode = 'P0001';
    else
      -- log overdraft intent in wallet_audit_log
      insert into public.wallet_audit_log(user_id, delta_sar, reason, confirmed_phrase, metadata)
      values (_user_id, -_amount, 'overdraft', _confirmation_phrase, jsonb_build_object('type', _type, 'note', _note));
    end if;
  end if;

  -- insert row
  insert into public.financial_data(user_id, type, amount, currency, label, note, created_at)
  values (_user_id, _type, _amount, 'SAR', coalesce(_note, _type), _note, _occurred_at);

  -- compute net after
  select coalesce(sum(case when type in ('income','savings') then amount when type in ('expense','investment') then -amount else 0 end), 0)
    into net_after
  from public.financial_data
  where user_id = _user_id;

  return json_build_object('ok', true, 'new_balance', net_after);
end;
$$;

revoke execute on function public.record_financial_with_wallet_profile(uuid, text, numeric, text, timestamptz, boolean, text) from public, anon;
grant execute on function public.record_financial_with_wallet_profile(uuid, text, numeric, text, timestamptz, boolean, text) to authenticated;
