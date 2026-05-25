-- Migration 1: Core tables

-- Required for gen_random_uuid()
create extension if not exists pgcrypto;

-- Enum types
do $$
begin
  if not exists (select 1 from pg_type where typname = 'source_type') then
    create type source_type as enum ('rss', 'api', 'community');
  end if;

  if not exists (select 1 from pg_type where typname = 'article_status') then
    create type article_status as enum ('pending', 'approved', 'rejected');
  end if;

  if not exists (select 1 from pg_type where typname = 'submission_status') then
    create type submission_status as enum ('pending', 'approved', 'rejected');
  end if;
end $$;

-- 1) categories
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  name text not null,
  slug text not null unique,
  description text,
  icon text,
  sort_order integer not null default 0
);

-- 2) sources
create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  name text not null,
  url text not null,
  type source_type not null,
  fetch_config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  last_fetched_at timestamptz
);

-- 3) articles
create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  title text not null,
  url text not null unique,
  source_id uuid not null references public.sources(id) on delete restrict,
  category_id uuid references public.categories(id) on delete set null,

  summary text,
  ai_summary text,
  image_url text,

  status article_status not null default 'pending',
  verify_count integer not null default 0 check (verify_count >= 0),
  is_community_submitted boolean not null default false,

  published_at timestamptz,
  ingested_at timestamptz not null default now()
);

-- 4) submissions
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  url text not null,
  suggested_title text,
  suggested_category_id uuid references public.categories(id) on delete set null,
  submitter_name text,
  submitter_ip inet,

  status submission_status not null default 'pending',
  article_id uuid references public.articles(id) on delete set null,
  submitted_at timestamptz not null default now()
);

-- 5) verifications
create table if not exists public.verifications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  article_id uuid not null references public.articles(id) on delete cascade,
  visitor_hash text not null,

  unique (article_id, visitor_hash)
);
