-- Migration: Track AI API usage for cost control

create table if not exists public.api_usage (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  calls integer not null default 0,
  -- NOTE: stores *tenths of a cent* to allow cheap-call accounting without decimals
  estimated_cost_cents integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep updated_at fresh
drop trigger if exists set_api_usage_updated_at on public.api_usage;
create trigger set_api_usage_updated_at
  before update on public.api_usage
  for each row
  execute function public.set_updated_at();

-- Atomic increment helper (preferred over read-modify-write)
create or replace function public.increment_api_usage(usage_date date, cost_tenths integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.api_usage (date, calls, estimated_cost_cents)
  values (usage_date, 1, greatest(cost_tenths, 0))
  on conflict (date) do update
    set calls = public.api_usage.calls + 1,
        estimated_cost_cents = public.api_usage.estimated_cost_cents + greatest(cost_tenths, 0),
        updated_at = now();
end;
$$;

-- Grant access (RLS still applies)
grant all on table public.api_usage to authenticated;

alter table public.api_usage enable row level security;

drop policy if exists authenticated_all_api_usage on public.api_usage;
create policy authenticated_all_api_usage
  on public.api_usage
  for all
  to authenticated
  using (true)
  with check (true);
