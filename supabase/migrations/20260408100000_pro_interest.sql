CREATE TABLE IF NOT EXISTS pro_interest (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  source text,
  features_wanted text[] DEFAULT '{}',
  company_size text,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pro_interest_created ON pro_interest(created_at DESC);

ALTER TABLE pro_interest ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY pro_interest_service_all ON pro_interest FOR ALL USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;