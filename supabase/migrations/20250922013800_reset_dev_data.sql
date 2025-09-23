-- Reset development data while preserving schema
-- SECURITY DEFINER allows execution via RPC from Edge Function
create or replace function public.reset_dev_data()
returns void
language plpgsql
security definer
as $$
begin
  execute 'truncate table public.financial_entries restart identity cascade';
  execute 'truncate table public.portfolio_holdings restart identity cascade';
  execute 'truncate table public.wallets restart identity cascade';
  execute 'truncate table public.tasks restart identity cascade';
  execute 'truncate table public.mood_logs restart identity cascade';
  execute 'truncate table public.goals restart identity cascade';
  execute 'truncate table public.knowledge_vault restart identity cascade';
end;
$$;

grant execute on function public.reset_dev_data() to authenticated, service_role;
