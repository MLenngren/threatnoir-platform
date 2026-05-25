-- Migration: Multi-label article tagging (LEN-1052)

-- Junction table for multi-label tagging
create table if not exists public.article_tags (
  article_id uuid not null references public.articles(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  primary key (article_id, category_id)
);

create index if not exists article_tags_article_idx on public.article_tags(article_id);
create index if not exists article_tags_category_idx on public.article_tags(category_id);

-- RLS
alter table public.article_tags enable row level security;

grant select on table public.article_tags to anon;
grant all on table public.article_tags to authenticated;

drop policy if exists anon_select_article_tags on public.article_tags;
create policy anon_select_article_tags on public.article_tags
  for select
  to anon
  using (true);

drop policy if exists authenticated_all_article_tags on public.article_tags;
create policy authenticated_all_article_tags on public.article_tags
  for all
  to authenticated
  using (true)
  with check (true);

-- New categories
insert into public.categories (name, slug, description, sort_order) values
  ('Zero-day', 'zero-day', 'Zero-day exploits and active exploitation', 11),
  ('Supply Chain', 'supply-chain', 'Supply chain attacks, dependency poisoning, build compromise', 12),
  ('Nation-state', 'nation-state', 'State-sponsored campaigns, APT operations, cyber warfare', 13),
  ('Incident Response', 'incident-response', 'IR playbooks, post-incident analysis, forensics', 14),
  ('Identity & Access', 'identity-access', 'IAM, MFA bypass, credential theft, authentication', 15),
  ('IoT/OT', 'iot-ot', 'IoT/OT security, industrial control systems, embedded devices', 16),
  ('Cryptography', 'cryptography', 'Encryption, quantum threats, protocol weaknesses', 17),
  ('Compliance', 'compliance', 'GDPR, NIS2, SEC rules, regulatory frameworks', 18),
  ('Open Source', 'open-source', 'OSS vulnerabilities, package security, dependency risks', 19)
on conflict (slug) do nothing;

-- Helper RPC: fetch approved article ids with (category OR tag) semantics + optional tag filter + search.
-- This avoids complex PostgREST OR filtering across embedded many-to-many relations.
create or replace function public.get_approved_article_ids(
  p_category_id uuid default null,
  p_tag_id uuid default null,
  p_search text default null,
  limit_count integer default 20,
  offset_count integer default 0
)
returns table (id uuid)
language sql
stable
set search_path = public
as $$
  select x.id
  from (
    select
      a.id,
      a.published_at,
      a.ingested_at
    from public.articles a
    left join public.article_tags at_cat
      on at_cat.article_id = a.id
     and p_category_id is not null
     and at_cat.category_id = p_category_id
    where a.status = 'approved'
      and (p_search is null or a.fts @@ websearch_to_tsquery('english', p_search))
      and (
        p_category_id is null
        or a.category_id = p_category_id
        or at_cat.article_id is not null
      )
      and (
        p_tag_id is null
        or exists (
          select 1
          from public.article_tags at_tag
          where at_tag.article_id = a.id
            and at_tag.category_id = p_tag_id
        )
      )
    group by a.id, a.published_at, a.ingested_at
  ) x
  order by x.published_at desc nulls last, x.ingested_at desc
  limit greatest(0, limit_count)
  offset greatest(0, offset_count);
$$;
