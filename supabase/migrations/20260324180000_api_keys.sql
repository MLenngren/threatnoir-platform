-- Migration: User API keys for IOC API

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key_hash text not null,
  key_prefix text not null,
  name text,
  scopes text[] not null default '{ioc:read}',
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

-- Fast lookups by hash (auth) + owner filtering
create unique index if not exists api_keys_key_hash_key on public.api_keys (key_hash);
create index if not exists api_keys_user_id_idx on public.api_keys (user_id);
create index if not exists api_keys_user_id_revoked_idx on public.api_keys (user_id, revoked_at);

alter table public.api_keys enable row level security;

-- Users can manage their own keys
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'api_keys' and policyname = 'api_keys_select_own'
  ) then
    create policy api_keys_select_own on public.api_keys
      for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'api_keys' and policyname = 'api_keys_insert_own'
  ) then
    create policy api_keys_insert_own on public.api_keys
      for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'api_keys' and policyname = 'api_keys_update_own'
  ) then
    create policy api_keys_update_own on public.api_keys
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;
