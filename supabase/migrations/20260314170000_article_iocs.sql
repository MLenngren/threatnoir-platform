-- Migration: Extracted Indicators of Compromise (IOCs) per article (LEN-1054)

create table if not exists public.article_iocs (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  type text not null check (type in (
    'ip',
    'domain',
    'hash_md5',
    'hash_sha1',
    'hash_sha256',
    'url',
    'cve',
    'mitre_attack',
    'email',
    'malware'
  )),
  value text not null,
  context text,
  created_at timestamptz not null default now(),
  unique (article_id, type, value)
);

create index if not exists article_iocs_article_idx on public.article_iocs(article_id);
create index if not exists article_iocs_type_idx on public.article_iocs(type);
create index if not exists article_iocs_value_idx on public.article_iocs(value);

-- Optional fuzzy search index (requires pg_trgm). If unavailable, skip.
do $$
begin
  begin
    execute 'create extension if not exists pg_trgm';
  exception when others then
    raise notice 'pg_trgm extension not available; skipping extension enable';
  end;

  begin
    execute 'create index if not exists article_iocs_value_trgm_idx on public.article_iocs using gin (value gin_trgm_ops)';
  exception when others then
    raise notice 'pg_trgm index could not be created; skipping trgm index';
  end;
end $$;

-- RLS
alter table public.article_iocs enable row level security;

grant select on table public.article_iocs to anon;
grant all on table public.article_iocs to authenticated;

drop policy if exists anon_select_article_iocs on public.article_iocs;
create policy anon_select_article_iocs
  on public.article_iocs
  for select
  to anon
  using (true);

drop policy if exists authenticated_all_article_iocs on public.article_iocs;
create policy authenticated_all_article_iocs
  on public.article_iocs
  for all
  to authenticated
  using (true)
  with check (true);
