-- Notification subscription system schema (LEN-1133)

-- Required for gen_random_uuid()
create extension if not exists pgcrypto;

-- Enums
do $$
begin
  if not exists (select 1 from pg_type where typname = 'preference_type') then
    create type public.preference_type as enum (
      'category',
      'regulation',
      'jurisdiction',
      'company',
      'industry',
      'ioc_type',
      'freetext'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'channel_type') then
    create type public.channel_type as enum (
      'email',
      'discord',
      'telegram',
      'x',
      'api',
      'webhook'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'notification_status') then
    create type public.notification_status as enum ('pending', 'sent', 'failed');
  end if;
end $$;

-- Subscribers
create table if not exists public.subscribers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text,
  verified boolean not null default false,
  verify_token text unique default gen_random_uuid()::text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Subscriber preferences (what they want to hear about)
create table if not exists public.subscriber_preferences (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references public.subscribers(id) on delete cascade,
  preference_type public.preference_type not null,
  preference_value text not null,
  created_at timestamptz not null default now(),
  unique (subscriber_id, preference_type, preference_value)
);

-- Subscriber notification channels (how they want to be notified)
create table if not exists public.subscriber_channels (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references public.subscribers(id) on delete cascade,
  channel_type public.channel_type not null,
  channel_config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  verified boolean not null default false,
  consecutive_failures integer not null default 0,
  created_at timestamptz not null default now()
);

-- Notification delivery log
create table if not exists public.notification_log (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references public.subscribers(id) on delete cascade,
  article_id uuid not null references public.articles(id) on delete cascade,
  channel_type public.channel_type not null,
  status public.notification_status not null default 'pending',
  sent_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  unique (subscriber_id, article_id, channel_type)
);

-- API access requests (manual review queue)
create table if not exists public.api_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  company text,
  use_case text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_subscriber_preferences_subscriber on public.subscriber_preferences(subscriber_id);
create index if not exists idx_subscriber_channels_subscriber on public.subscriber_channels(subscriber_id);
create index if not exists idx_notification_log_article_status on public.notification_log(article_id, status);
create index if not exists idx_notification_log_subscriber on public.notification_log(subscriber_id, created_at desc);
create index if not exists idx_subscribers_verify_token on public.subscribers(verify_token);
create index if not exists idx_subscribers_email on public.subscribers(email);

-- Keep subscribers.updated_at current
drop trigger if exists set_subscribers_updated_at on public.subscribers;
create trigger set_subscribers_updated_at
  before update on public.subscribers
  for each row
  execute function public.set_updated_at();

-- RLS
alter table public.subscribers enable row level security;
alter table public.subscriber_preferences enable row level security;
alter table public.subscriber_channels enable row level security;
alter table public.notification_log enable row level security;
alter table public.api_requests enable row level security;

-- Grants (RLS still applies)
grant all on table public.subscribers to authenticated;
grant all on table public.subscribers to service_role;
grant all on table public.subscriber_preferences to authenticated;
grant all on table public.subscriber_preferences to service_role;
grant all on table public.subscriber_channels to authenticated;
grant all on table public.subscriber_channels to service_role;
grant all on table public.notification_log to authenticated;
grant all on table public.notification_log to service_role;
grant all on table public.api_requests to authenticated;
grant all on table public.api_requests to service_role;

-- Service role has full access (used by API routes)
do $$ begin
  create policy "Service role full access" on public.subscribers
    for all using (auth.role() = 'service_role');
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Service role full access" on public.subscriber_preferences
    for all using (auth.role() = 'service_role');
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Service role full access" on public.subscriber_channels
    for all using (auth.role() = 'service_role');
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Service role full access" on public.notification_log
    for all using (auth.role() = 'service_role');
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Service role full access" on public.api_requests
    for all using (auth.role() = 'service_role');
exception when duplicate_object then null;
end $$;
