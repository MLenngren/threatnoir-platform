-- LEN-1156: Podcast extended edition interest signup

create table if not exists podcast_interest (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  preferences jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

alter table podcast_interest enable row level security;

DO $$ BEGIN
  create policy "Service role full access" on podcast_interest for all using (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

create index if not exists idx_podcast_interest_created_at on podcast_interest(created_at desc);
