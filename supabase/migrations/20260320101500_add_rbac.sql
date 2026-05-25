-- Migration: Add RBAC for authenticated users via app_metadata.role = 'admin'
--
-- Goal:
-- - Replace overly-permissive authenticated_all_* policies with admin-only policies.
-- - Restrict anon_update_own_verifications (was effectively allowing anon to update any row).

-- Helper predicate (inline) used below:
--   (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'

-- 1) Admin-only CRUD policies for authenticated users

-- categories
drop policy if exists authenticated_all_categories on public.categories;
drop policy if exists admin_all_categories on public.categories;
create policy admin_all_categories
  on public.categories
  for all
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- sources
drop policy if exists authenticated_all_sources on public.sources;
drop policy if exists admin_all_sources on public.sources;
create policy admin_all_sources
  on public.sources
  for all
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- articles
drop policy if exists authenticated_all_articles on public.articles;
drop policy if exists admin_all_articles on public.articles;
create policy admin_all_articles
  on public.articles
  for all
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- submissions
drop policy if exists authenticated_all_submissions on public.submissions;
drop policy if exists admin_all_submissions on public.submissions;
create policy admin_all_submissions
  on public.submissions
  for all
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- verifications (ratings)
drop policy if exists authenticated_all_verifications on public.verifications;
drop policy if exists admin_all_verifications on public.verifications;
create policy admin_all_verifications
  on public.verifications
  for all
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- api_usage
drop policy if exists authenticated_all_api_usage on public.api_usage;
drop policy if exists admin_all_api_usage on public.api_usage;
create policy admin_all_api_usage
  on public.api_usage
  for all
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- article_tags
drop policy if exists authenticated_all_article_tags on public.article_tags;
drop policy if exists admin_all_article_tags on public.article_tags;
create policy admin_all_article_tags
  on public.article_tags
  for all
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- article_iocs
drop policy if exists authenticated_all_article_iocs on public.article_iocs;
drop policy if exists admin_all_article_iocs on public.article_iocs;
create policy admin_all_article_iocs
  on public.article_iocs
  for all
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- x_accounts
drop policy if exists authenticated_all_x_accounts on public.x_accounts;
drop policy if exists admin_all_x_accounts on public.x_accounts;
create policy admin_all_x_accounts
  on public.x_accounts
  for all
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');


-- 2) Fix M-2: Restrict anon_update_own_verifications
-- Previously: using (true) / with check (true) => any anon could update any row.
--
-- We treat "own" as "caller proves knowledge of the visitor_hash" by sending it in an HTTP header.
-- If the header is missing, UPDATE is denied.
--
-- Note: the app currently uses the service role for rating writes, so this mainly closes the public PostgREST hole.

drop policy if exists anon_update_own_verifications on public.verifications;
create policy anon_update_own_verifications
  on public.verifications
  for update
  to anon
  using (
    visitor_hash = coalesce((current_setting('request.headers', true)::json ->> 'x-visitor-hash'), '')
  )
  with check (
    visitor_hash = coalesce((current_setting('request.headers', true)::json ->> 'x-visitor-hash'), '')
  );
