-- Migration: X/Twitter sources + tracked accounts (LEN-1055)

-- Add X account tracking table
create table if not exists public.x_accounts (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  display_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Track last ingestion state for API sources (X uses this)
alter table public.sources
  add column if not exists last_since_id text;

-- RLS / grants
alter table public.x_accounts enable row level security;

grant select on table public.x_accounts to anon;
grant all on table public.x_accounts to authenticated;

drop policy if exists anon_select_x_accounts on public.x_accounts;
create policy anon_select_x_accounts
  on public.x_accounts
  for select
  to anon
  using (true);

drop policy if exists authenticated_all_x_accounts on public.x_accounts;
create policy authenticated_all_x_accounts
  on public.x_accounts
  for all
  to authenticated
  using (true)
  with check (true);

-- Seed initial accounts (best-effort; manageable in admin UI)
insert into public.x_accounts (username, display_name)
values
  ('TheDFIRReport', 'The DFIR Report'),
  ('Unit42_Intel', 'Unit 42'),
  ('malwrhunterteam', 'MalwareHunterTeam'),
  ('abuse_ch', 'abuse.ch'),
  ('elasticseclabs', 'Elastic Security Labs'),
  ('nextronresearch', 'Nextron Systems'),
  ('DarkWebInformer', 'Dark Web Informer'),
  ('vxunderground', 'vx-underground'),
  ('Cryptolaemus1', 'Cryptolaemus'),
  ('SwiftOnSecurity', 'SwiftOnSecurity'),
  ('GossiTheDog', 'Kevin Beaumont'),
  ('campuscodi', 'Catalin Cimpanu'),
  ('RecordedFuture', 'Recorded Future'),
  ('MandiantIntel', 'Mandiant Intelligence'),
  ('SentinelOne', 'SentinelOne'),
  ('CrowdStrike', 'CrowdStrike'),
  ('CISAgov', 'CISA'),
  ('NSACyber', 'NSA Cybersecurity'),
  ('FBI', 'FBI'),
  ('FBIIC3', 'IC3'),
  ('NCSC', 'NCSC UK'),
  ('CERT_EU', 'CERT-EU'),
  ('briankrebs', 'Brian Krebs'),
  ('troyhunt', 'Troy Hunt'),
  ('schneierblog', 'Bruce Schneier'),
  ('IanColdwater', 'Ian Coldwater'),
  ('hack4pancakes', 'hack4pancakes')
on conflict (username) do nothing;

-- Create a source entry for X ingestion (idempotent)
insert into public.sources (name, url, type, is_active)
select 'X / Twitter', 'https://api.twitter.com/2/tweets/search/recent', 'api'::source_type, true
where not exists (
  select 1 from public.sources where name = 'X / Twitter' and type = 'api'
);
