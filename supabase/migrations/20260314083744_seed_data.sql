-- Migration 6: Seed data

-- Categories
insert into public.categories (name, slug, description, icon, sort_order)
values
  ('Vulnerabilities', 'vulnerabilities', null, null, 10),
  ('Breaches', 'breaches', null, null, 20),
  ('Malware', 'malware', null, null, 30),
  ('Ransomware', 'ransomware', null, null, 40),
  ('Policy', 'policy', null, null, 50),
  ('Tools', 'tools', null, null, 60),
  ('Cloud Security', 'cloud-security', null, null, 70),
  ('AI Security', 'ai-security', null, null, 80),
  ('Threat Intelligence', 'threat-intelligence', null, null, 90),
  ('Privacy', 'privacy', null, null, 100)
on conflict (slug)
do update set
  name = excluded.name,
  description = excluded.description,
  icon = excluded.icon,
  sort_order = excluded.sort_order;

-- Sources
with seed(name, url, type) as (
  values
    ('BleepingComputer', 'https://www.bleepingcomputer.com/feed/', 'rss'::source_type),
    ('The Hacker News', 'https://feeds.feedburner.com/TheHackersNews', 'rss'::source_type),
    ('Krebs on Security', 'https://krebsonsecurity.com/feed/', 'rss'::source_type),
    ('CISA Alerts', 'https://www.cisa.gov/cybersecurity-advisories/all.xml', 'rss'::source_type),
    ('SecurityWeek', 'https://feeds.feedburner.com/securityweek', 'rss'::source_type),
    ('Dark Reading', 'https://www.darkreading.com/rss.xml', 'rss'::source_type)
)
insert into public.sources (name, url, type, fetch_config, is_active)
select s.name, s.url, s.type, '{}'::jsonb, true
from seed s
where not exists (
  select 1 from public.sources existing where existing.url = s.url
);
