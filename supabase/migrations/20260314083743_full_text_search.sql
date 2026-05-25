-- Migration 5: Full-text search

alter table public.articles
  add column if not exists fts tsvector
    generated always as (
      to_tsvector(
        'english',
        coalesce(title, '') || ' ' || coalesce(summary, '')
      )
    ) stored;

create index if not exists articles_fts_idx on public.articles using gin (fts);
