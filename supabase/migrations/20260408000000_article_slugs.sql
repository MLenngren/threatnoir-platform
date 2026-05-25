ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS slug text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_slug ON public.articles(slug) WHERE slug IS NOT NULL;
