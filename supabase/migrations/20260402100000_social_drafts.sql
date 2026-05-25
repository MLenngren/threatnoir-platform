CREATE TABLE IF NOT EXISTS social_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL DEFAULT 'both',
  text_x text,
  text_linkedin text,
  article_ids uuid[],
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'posted', 'skipped')),
  hook_text text,
  posted_url text,
  posted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_drafts_status ON social_drafts(status);
CREATE INDEX IF NOT EXISTS idx_social_drafts_created ON social_drafts(created_at DESC);

DROP TRIGGER IF EXISTS set_social_drafts_updated_at ON public.social_drafts;
CREATE TRIGGER set_social_drafts_updated_at
  BEFORE UPDATE ON public.social_drafts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE social_drafts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY social_drafts_service_all ON social_drafts FOR ALL USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
