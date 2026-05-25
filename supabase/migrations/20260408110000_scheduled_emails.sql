CREATE TABLE IF NOT EXISTS scheduled_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id uuid REFERENCES subscribers(id) ON DELETE CASCADE,
  template text NOT NULL,
  scheduled_for timestamptz NOT NULL,
  sent_at timestamptz,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  error text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_emails_pending
  ON scheduled_emails(status, scheduled_for)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_scheduled_emails_subscriber ON scheduled_emails(subscriber_id);

ALTER TABLE scheduled_emails ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY scheduled_emails_service_all ON scheduled_emails FOR ALL USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
