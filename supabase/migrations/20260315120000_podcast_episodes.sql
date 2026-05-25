create table if not exists podcast_episodes (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  title text not null,
  duration_seconds integer,
  audio_url text not null,
  article_count integer default 0,
  article_ids uuid[] default '{}',
  dialogue jsonb,
  cost_cents numeric(6,2) default 0,
  total_characters integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table podcast_episodes enable row level security;

DO $$ BEGIN
  create policy "Public read" on podcast_episodes for select using (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  create policy "Service role full access" on podcast_episodes for all using (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

create index if not exists idx_podcast_episodes_date on podcast_episodes(date desc);
