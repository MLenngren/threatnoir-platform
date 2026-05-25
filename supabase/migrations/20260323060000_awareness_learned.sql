-- Awareness Learned: root-cause lessons derived from security articles (LEN-1160)

-- Awareness category tags
create table if not exists awareness_tags (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  slug        text not null unique,
  description text,
  color       text,
  created_at  timestamptz not null default now()
);

-- Awareness lessons linked to source articles
create table if not exists awareness_lessons (
  id              uuid primary key default gen_random_uuid(),
  article_id      uuid references articles(id) on delete set null,
  title           text not null,
  body            text not null,
  prevention      text,
  framework_refs  text[] default '{}',
  status          text not null default 'draft' check (status in ('draft', 'published')),
  created_at      timestamptz not null default now(),
  published_at    timestamptz
);

-- Junction table for lesson <-> tag many-to-many
create table if not exists awareness_lesson_tags (
  lesson_id uuid not null references awareness_lessons(id) on delete cascade,
  tag_id    uuid not null references awareness_tags(id) on delete cascade,
  primary key (lesson_id, tag_id)
);

-- Indexes
create index if not exists idx_awareness_lessons_status on awareness_lessons(status);
create index if not exists idx_awareness_lessons_article on awareness_lessons(article_id);
create index if not exists idx_awareness_lessons_published on awareness_lessons(published_at desc) where status = 'published';
create index if not exists idx_awareness_lesson_tags_tag on awareness_lesson_tags(tag_id);

-- RLS policies
alter table awareness_tags enable row level security;
alter table awareness_lessons enable row level security;
alter table awareness_lesson_tags enable row level security;

-- Public read for published lessons and all tags
create policy "awareness_tags_public_read" on awareness_tags for select using (true);
create policy "awareness_lessons_public_read" on awareness_lessons for select using (status = 'published');
create policy "awareness_lesson_tags_public_read" on awareness_lesson_tags for select using (
  exists (select 1 from awareness_lessons where id = lesson_id and status = 'published')
);

-- Service role full access (for cron/admin API routes)
create policy "awareness_tags_service_all" on awareness_tags for all using (auth.role() = 'service_role');
create policy "awareness_lessons_service_all" on awareness_lessons for all using (auth.role() = 'service_role');
create policy "awareness_lesson_tags_service_all" on awareness_lesson_tags for all using (auth.role() = 'service_role');

-- Seed initial awareness categories
insert into awareness_tags (name, slug, description, color) values
  ('Patch Management',        'patch-management',        'Unpatched vulnerabilities, delayed updates',                '#ef4444'),
  ('Access Control',          'access-control',          'Excessive privileges, missing MFA, weak auth',              '#f97316'),
  ('Configuration Management','configuration-management','Misconfigs, default credentials, exposed services',         '#eab308'),
  ('Security Awareness',      'security-awareness',      'Phishing, social engineering, human error',                 '#22c55e'),
  ('Incident Response',       'incident-response',       'Slow detection, poor containment, missing playbooks',       '#14b8a6'),
  ('Network Segmentation',    'network-segmentation',    'Lateral movement, flat networks, missing firewalls',        '#06b6d4'),
  ('Data Protection',         'data-protection',         'Unencrypted data, missing DLP, poor classification',        '#3b82f6'),
  ('Supply Chain',            'supply-chain',            'Third-party risk, compromised dependencies',                '#8b5cf6'),
  ('Logging & Monitoring',    'logging-monitoring',      'Missing logs, no alerting, blind spots',                    '#a855f7'),
  ('Regulatory Compliance',   'regulatory-compliance',   'GDPR, NIS2, DORA, sector-specific violations',             '#ec4899'),
  ('Backup & Recovery',       'backup-recovery',         'No backups, untested recovery, ransomware impact',          '#f43f5e'),
  ('Vulnerability Management','vulnerability-management','Missing scans, no risk prioritization',                     '#fb923c')
on conflict (slug) do nothing;
