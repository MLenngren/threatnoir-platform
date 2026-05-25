-- Migration: audit_log table for admin mutation auditing

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  action text not null,
  resource_type text not null,
  resource_id text,
  details jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_log enable row level security;

-- Only admins can read, only service_role can write
create policy "admin_read_audit_log" on public.audit_log
  for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "service_write_audit_log" on public.audit_log
  for insert to service_role
  with check (true);

