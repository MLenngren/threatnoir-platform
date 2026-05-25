-- Resources: curated security posters, infographics, cheat sheets (LEN-1207)
CREATE TABLE IF NOT EXISTS resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  image_url text,
  content_type text NOT NULL DEFAULT 'poster' CHECK (content_type IN ('poster', 'infographic', 'cheat_sheet', 'guide')),
  category text,
  tags text[] DEFAULT '{}'::text[],
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  featured boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_resources_status ON resources(status);
CREATE INDEX IF NOT EXISTS idx_resources_category ON resources(category);

ALTER TABLE resources ENABLE ROW LEVEL SECURITY;

-- Public read for published resources
DO $$ BEGIN
  CREATE POLICY resources_public_read ON resources FOR SELECT USING (status = 'published');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Service role full access
DO $$ BEGIN
  CREATE POLICY resources_service_all ON resources FOR ALL USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
