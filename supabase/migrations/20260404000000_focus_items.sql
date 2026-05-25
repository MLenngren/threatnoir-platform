-- Focus items

CREATE TABLE IF NOT EXISTS focus_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text UNIQUE,
  summary text NOT NULL,
  severity text NOT NULL DEFAULT 'critical' CHECK (severity IN ('critical', 'high', 'medium')),
  category text NOT NULL DEFAULT 'cve' CHECK (category IN ('cve', 'breach', 'exploit', 'campaign', 'advisory')),
  cve_ids text[] DEFAULT '{}',
  affected_products text[] DEFAULT '{}',
  action_required text,
  article_ids uuid[] DEFAULT '{}',
  ioc_summary text,
  source_urls text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'archived')),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_focus_items_status ON focus_items(status);
CREATE INDEX IF NOT EXISTS idx_focus_items_created ON focus_items(created_at DESC);

DROP TRIGGER IF EXISTS set_focus_items_updated_at ON public.focus_items;
CREATE TRIGGER set_focus_items_updated_at
  BEFORE UPDATE ON public.focus_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE focus_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY focus_items_public_read ON focus_items FOR SELECT USING (status = 'active');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY focus_items_authenticated_read ON focus_items FOR SELECT TO authenticated USING (status IN ('active', 'archived'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY focus_items_service_all ON focus_items FOR ALL USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
