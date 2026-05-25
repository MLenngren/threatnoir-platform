-- Migration: User management (profiles + blocking)

-- 1) profiles table (extends auth.users)
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  is_blocked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Keep updated_at fresh
drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

-- Users can read/update their own profile
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_select_own'
  ) then
    create policy profiles_select_own on public.profiles
      for select to authenticated
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_update_own'
  ) then
    create policy profiles_update_own on public.profiles
      for update to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  -- Allow service_role to insert/update profiles (admin backfills, triggers, admin tooling)
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_service_insert'
  ) then
    create policy profiles_service_insert on public.profiles
      for insert to service_role
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_service_update'
  ) then
    create policy profiles_service_update on public.profiles
      for update to service_role
      using (true)
      with check (true);
  end if;
end $$;

-- 2) trigger: create profile row when a new auth user is created
create or replace function public.handle_new_user_create_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, null)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row
  execute function public.handle_new_user_create_profile();

-- 3) backfill: ensure existing auth users have profiles
insert into public.profiles (user_id)
select u.id
from auth.users u
left join public.profiles p on p.user_id = u.id
where p.user_id is null;
