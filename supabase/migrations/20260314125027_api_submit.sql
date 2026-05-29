-- Migration: Track API submissions + ensure an API/manual source exists

-- Track how articles were submitted
alter table public.articles
  add column if not exists submitted_via text not null default 'rss';

-- Values: 'rss', 'api', 'web', 'admin'

-- Add a source for manual/API submissions (idempotent)
insert into public.sources (name, url, type, is_active)
select 'Manual / API', 'https://example.com', 'api'::source_type, true
where not exists (
  select 1 from public.sources where name = 'Manual / API' and type = 'api'
);
