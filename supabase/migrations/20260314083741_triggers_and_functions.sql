-- Migration 4: Triggers and functions

-- 1) updated_at trigger
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_articles_updated_at on public.articles;
create trigger set_articles_updated_at
  before update on public.articles
  for each row
  execute function public.set_updated_at();

drop trigger if exists set_submissions_updated_at on public.submissions;
create trigger set_submissions_updated_at
  before update on public.submissions
  for each row
  execute function public.set_updated_at();

-- 2) increment_verify_count trigger
create or replace function public.increment_verify_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.articles
    set verify_count = verify_count + 1
    where id = new.article_id;
  return new;
end;
$$;

drop trigger if exists on_verification_insert on public.verifications;
create trigger on_verification_insert
  after insert on public.verifications
  for each row
  execute function public.increment_verify_count();
