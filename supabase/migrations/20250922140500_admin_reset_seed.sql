-- Dev reset with seed balance and safe truncation
create or replace function public.reset_dev_data_seed(_seed numeric)
returns void
language plpgsql
security definer
as $$
begin
  -- Truncate activity tables
  execute 'truncate table public.financial_entries restart identity cascade';
  execute 'truncate table public.savings_contributions restart identity cascade';
  execute 'truncate table public.tasks restart identity cascade';
  execute 'truncate table public.mood_logs restart identity cascade';
  execute 'truncate table public.knowledge_vault restart identity cascade';
  execute 'truncate table public.portfolio_holdings restart identity cascade';
  -- Reset wallets to seed
  update public.wallets
    set balance = coalesce(_seed, 0),
        updated_at = now();
end;
$$;

grant execute on function public.reset_dev_data_seed(numeric) to authenticated, service_role;
