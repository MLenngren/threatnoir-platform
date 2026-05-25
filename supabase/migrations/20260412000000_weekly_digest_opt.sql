ALTER TABLE subscribers
  ADD COLUMN IF NOT EXISTS weekly_digest_enabled boolean DEFAULT true;
