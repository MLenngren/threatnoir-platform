-- Migration: Add legal/privacy/regulatory RSS sources (LEN-1129)

with seed(name, url) as (
  values
    ('GDPRHub', 'https://gdprhub.eu/index.php?title=Special:RecentChanges&feed=rss'),
    ('NOYB', 'https://noyb.eu/en/rss.xml'),
    ('European Data Protection Board (EDPB)', 'https://www.edpb.europa.eu/rss.xml'),
    ('CNIL', 'https://www.cnil.fr/en/rss.xml'),
    ('European Data Protection Supervisor (EDPS)', 'https://www.edps.europa.eu/feed/news_en')
)
insert into public.sources (name, url, type, fetch_config, is_active)
select s.name, s.url, 'rss'::source_type, '{}'::jsonb, true
from seed s
where not exists (
  select 1 from public.sources existing where existing.url = s.url
);

