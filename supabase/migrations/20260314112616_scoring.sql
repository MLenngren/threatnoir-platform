-- Migration: Replace verify with 1-10 scoring (ratings)

-- Add score column to verifications (conceptually "ratings")
alter table public.verifications
  add column if not exists score integer not null default 5 check (score >= 1 and score <= 10);

alter table public.verifications
  add column if not exists updated_at timestamptz not null default now();

-- Keep updated_at current on UPDATE
drop trigger if exists set_verifications_updated_at on public.verifications;
create trigger set_verifications_updated_at
  before update on public.verifications
  for each row
  execute function public.set_updated_at();

-- Add avg_score and score_count to articles
alter table public.articles
  add column if not exists avg_score numeric(3, 1) default null;

alter table public.articles
  add column if not exists score_count integer not null default 0;

-- Drop old verify_count trigger/function
drop trigger if exists on_verification_insert on public.verifications;
drop function if exists public.increment_verify_count();

-- New function: recalculate avg_score and score_count on articles
create or replace function public.recalculate_article_score()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_article uuid;
begin
  target_article := coalesce(new.article_id, old.article_id);

  update public.articles
    set avg_score = (
      select round(avg(score)::numeric, 1)
      from public.verifications
      where article_id = target_article
    ),
    score_count = (
      select count(*)
      from public.verifications
      where article_id = target_article
    )
    where id = target_article;

  return new;
end;
$$;

drop trigger if exists on_rating_change on public.verifications;
create trigger on_rating_change
  after insert or update on public.verifications
  for each row
  execute function public.recalculate_article_score();

-- Backfill aggregates for existing rows
update public.articles a
set
  avg_score = s.avg_score,
  score_count = s.score_count
from (
  select
    article_id,
    round(avg(score)::numeric, 1) as avg_score,
    count(*)::integer as score_count
  from public.verifications
  group by article_id
) s
where a.id = s.article_id;

update public.articles
set avg_score = null,
    score_count = 0
where id not in (select distinct article_id from public.verifications);

-- RLS: allow anon to UPDATE ratings (upsert pattern)
grant update on table public.verifications to anon;

drop policy if exists anon_update_own_verifications on public.verifications;
create policy anon_update_own_verifications
  on public.verifications
  for update
  to anon
  using (true)
  with check (true);
