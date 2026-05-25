-- Migration: Video briefings table for daily security video generation

create table if not exists public.video_briefings (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  audience text not null check (audience in ('executive', 'soc', 'engineer')),
  title text not null,
  duration_seconds integer,
  video_url text not null,
  thumbnail_url text,
  article_count integer not null default 0,
  article_ids uuid[] default '{}',
  script jsonb,
  cost_cents numeric(6,2) default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(date, audience)
);

create index if not exists idx_video_briefings_date on video_briefings(date desc);
create index if not exists idx_video_briefings_audience on video_briefings(audience);

-- RLS
alter table video_briefings enable row level security;

create policy "Public read access"
  on video_briefings for select
  using (true);

create policy "Service role full access"
  on video_briefings for all
  using (auth.role() = 'service_role');

-- Auto-update trigger (reuses existing set_updated_at function from triggers_and_functions migration)
create trigger set_updated_at
  before update on video_briefings
  for each row execute function set_updated_at();
