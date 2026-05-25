-- Tip submissions (LEN-1191)

create table if not exists public.tip_submissions (
  id                 uuid primary key default gen_random_uuid(),
  title              text not null,
  body               text not null,
  suggested_category text,
  submitter_name     text not null,
  submitter_email    text,
  status             text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewer_notes     text,
  reviewed_at        timestamptz,
  created_at         timestamptz default now()
);

-- Indexes
create index if not exists idx_tip_submissions_status on public.tip_submissions(status);
create index if not exists idx_tip_submissions_created_at on public.tip_submissions(created_at desc);

-- RLS
alter table public.tip_submissions enable row level security;

-- Anyone can insert (submit a tip)
drop policy if exists tip_submissions_anyone_insert on public.tip_submissions;
create policy tip_submissions_anyone_insert
  on public.tip_submissions
  for insert
  with check (true);

-- Only service role can read/update/delete (admin routes)
drop policy if exists tip_submissions_service_all on public.tip_submissions;
create policy tip_submissions_service_all
  on public.tip_submissions
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Grant insert to anon for public submissions
grant insert on table public.tip_submissions to anon;
