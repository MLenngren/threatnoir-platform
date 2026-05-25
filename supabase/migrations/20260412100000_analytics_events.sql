-- Analytics events (client-side tracking)

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  path text,
  referrer text,
  metadata jsonb default '{}'::jsonb,
  ip_hash text,
  user_agent text,
  created_at timestamptz default now()
);

create index if not exists idx_analytics_events_type_created
  on public.analytics_events (event_type, created_at desc);

create index if not exists idx_analytics_events_created
  on public.analytics_events (created_at desc);

-- RLS: public can INSERT (tracking), only service_role can SELECT (admin API uses service role)
alter table public.analytics_events enable row level security;

-- Ensure roles can reach the schema/tables (RLS still applies)
grant usage on schema public to anon, authenticated;

grant insert on table public.analytics_events to anon, authenticated;
grant select on table public.analytics_events to service_role;

drop policy if exists analytics_events_insert on public.analytics_events;
create policy analytics_events_insert
  on public.analytics_events
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists analytics_events_select on public.analytics_events;
create policy analytics_events_select
  on public.analytics_events
  for select
  to service_role
  using (true);

-- Auto-delete events older than 90 days (privacy)
-- Handled by a periodic cleanup query.
