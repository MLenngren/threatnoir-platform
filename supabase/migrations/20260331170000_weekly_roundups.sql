-- Weekly Threat Roundups (LEN-1217)
CREATE TABLE IF NOT EXISTS weekly_roundups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_label text NOT NULL UNIQUE,        -- e.g. "2026-W14"
  slug text UNIQUE,                       -- e.g. "2026-w14"
  date_from date NOT NULL,
  date_to date NOT NULL,
  tldr text,                              -- 3-5 bullet social summary
  full_brief text,                        -- Full markdown brief
  top_iocs jsonb DEFAULT '[]'::jsonb,     -- [{type, value, context}]
  social_linkedin text,                   -- Ready-to-post LinkedIn text
  social_x text,                          -- Ready-to-post X text
  article_count int DEFAULT 0,
  awareness_links jsonb DEFAULT '[]'::jsonb, -- [{slug, title}]
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_at timestamptz,
	  created_at timestamptz NOT NULL DEFAULT now(),
	  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_weekly_roundups_status ON weekly_roundups(status);
CREATE INDEX IF NOT EXISTS idx_weekly_roundups_slug ON weekly_roundups(slug);
	CREATE INDEX IF NOT EXISTS idx_weekly_roundups_date_from ON weekly_roundups(date_from desc);

	-- Keep updated_at fresh
	DROP TRIGGER IF EXISTS set_weekly_roundups_updated_at ON public.weekly_roundups;
	CREATE TRIGGER set_weekly_roundups_updated_at
	  BEFORE UPDATE ON public.weekly_roundups
	  FOR EACH ROW
	  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE weekly_roundups ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY weekly_roundups_public_read ON weekly_roundups FOR SELECT USING (status = 'published');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY weekly_roundups_service_all ON weekly_roundups FOR ALL USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
