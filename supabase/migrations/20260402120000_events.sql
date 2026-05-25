-- Events

CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text UNIQUE,
  description text,
  url text,
  start_date date NOT NULL,
  end_date date,
  location text,
  is_virtual boolean DEFAULT false,
  organizer text,
  category text DEFAULT 'conference' CHECK (category IN ('conference', 'workshop', 'webinar', 'ctf', 'meetup')),
  tags text[] DEFAULT '{}',
  image_url text,
  source_url text,
  source_name text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  is_community_submitted boolean DEFAULT false,
  submitted_by_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_start_date ON events(start_date);
CREATE INDEX IF NOT EXISTS idx_events_slug ON events(slug);

DROP TRIGGER IF EXISTS set_events_updated_at ON public.events;
CREATE TRIGGER set_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY events_public_read ON events FOR SELECT USING (status = 'approved');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY events_authenticated_read ON events FOR SELECT TO authenticated USING (status = 'approved');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY events_service_all ON events FOR ALL USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Event sources

CREATE TABLE IF NOT EXISTS event_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text NOT NULL UNIQUE,
  scraper_type text NOT NULL DEFAULT 'generic',
  is_active boolean DEFAULT true,
  last_ingested_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE event_sources ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY event_sources_service_all ON event_sources FOR ALL USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Seed initial sources

INSERT INTO event_sources (name, url, scraper_type) VALUES
  ('InfoSec Conferences', 'https://infosec-conferences.com/', 'infosec-conferences'),
  ('SIA Events', 'https://www.securityindustry.org/sia-events/', 'generic'),
  ('Dev Events EU Security', 'https://dev.events/EU/security', 'dev-events')
ON CONFLICT (url) DO NOTHING;