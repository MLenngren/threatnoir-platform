-- Parent/update relationship between articles
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS parent_article_id uuid REFERENCES public.articles(id) ON DELETE SET NULL;

ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS relation_type text CHECK (relation_type IN ('update', 'follow-up', NULL));

CREATE INDEX IF NOT EXISTS idx_articles_parent
  ON public.articles(parent_article_id)
  WHERE parent_article_id IS NOT NULL;
