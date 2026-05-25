-- Migration 3: RLS policies

-- Enable RLS
alter table public.categories enable row level security;
alter table public.sources enable row level security;
alter table public.articles enable row level security;
alter table public.submissions enable row level security;
alter table public.verifications enable row level security;

-- Ensure roles can reach the schema/tables (RLS still applies)
grant usage on schema public to anon, authenticated;

-- Public (anon)
grant select on table public.categories to anon;
grant select on table public.articles to anon;
grant insert on table public.submissions to anon;
grant insert on table public.verifications to anon;

drop policy if exists anon_select_categories on public.categories;
create policy anon_select_categories
  on public.categories
  for select
  to anon
  using (true);

drop policy if exists anon_select_approved_articles on public.articles;
create policy anon_select_approved_articles
  on public.articles
  for select
  to anon
  using (status = 'approved');

drop policy if exists anon_insert_submissions on public.submissions;
create policy anon_insert_submissions
  on public.submissions
  for insert
  to anon
  with check (true);

drop policy if exists anon_insert_verifications on public.verifications;
create policy anon_insert_verifications
  on public.verifications
  for insert
  to anon
  with check (true);

-- Admin (authenticated) - full CRUD on all tables
grant all on table public.categories to authenticated;
grant all on table public.sources to authenticated;
grant all on table public.articles to authenticated;
grant all on table public.submissions to authenticated;
grant all on table public.verifications to authenticated;

drop policy if exists authenticated_all_categories on public.categories;
create policy authenticated_all_categories
  on public.categories
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists authenticated_all_sources on public.sources;
create policy authenticated_all_sources
  on public.sources
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists authenticated_all_articles on public.articles;
create policy authenticated_all_articles
  on public.articles
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists authenticated_all_submissions on public.submissions;
create policy authenticated_all_submissions
  on public.submissions
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists authenticated_all_verifications on public.verifications;
create policy authenticated_all_verifications
  on public.verifications
  for all
  to authenticated
  using (true)
  with check (true);
