-- LEN-1162: Add Reddit as a source type + seed subreddit sources

-- 1) Extend enum: source_type += 'reddit'
do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'source_type' and e.enumlabel = 'reddit'
  ) then
    execute 'alter type source_type add value ''reddit''';
  end if;
end $$;

-- 2) Track Reddit post IDs for de-duplication across runs
alter table public.articles
  add column if not exists reddit_post_id text;

do $$
begin
  -- Unique constraint enables fast dedup and prevents accidental double-ingest.
  begin
    alter table public.articles
      add constraint articles_reddit_post_id_key unique (reddit_post_id);
  exception when duplicate_object then
    null;
  end;
end $$;

create index if not exists articles_reddit_post_id_idx on public.articles (reddit_post_id);

-- 3) Seed subreddit sources (idempotent)
with seed(name, url) as (
  values
    ('r/netsec', 'https://www.reddit.com/r/netsec/'),
    ('r/cybersecurity', 'https://www.reddit.com/r/cybersecurity/')
)
insert into public.sources (name, url, type, fetch_config, is_active)
select s.name, s.url, 'reddit'::source_type, '{}'::jsonb, true
from seed s
where not exists (
  select 1 from public.sources existing
  where existing.url = s.url and existing.type = 'reddit'::source_type
);
