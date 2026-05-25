-- Migration 2: Indexes

-- articles
create index if not exists articles_status_idx on public.articles (status);
create index if not exists articles_category_id_idx on public.articles (category_id);
create index if not exists articles_source_id_idx on public.articles (source_id);
create index if not exists articles_published_at_desc_idx on public.articles (published_at desc);
create index if not exists articles_ingested_at_desc_idx on public.articles (ingested_at desc);

-- categories
-- slug is already indexed via the UNIQUE constraint

-- submissions
create index if not exists submissions_status_idx on public.submissions (status);
create index if not exists submissions_submitted_at_desc_idx on public.submissions (submitted_at desc);

-- sources
create index if not exists sources_is_active_idx on public.sources (is_active);
