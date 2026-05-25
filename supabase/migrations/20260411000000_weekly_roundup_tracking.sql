-- Track which weekly roundup each subscriber was last notified about
ALTER TABLE subscribers
  ADD COLUMN IF NOT EXISTS last_weekly_notified_slug text DEFAULT NULL;

-- Index for efficient lookup during notification cron
CREATE INDEX IF NOT EXISTS idx_subscribers_last_weekly_notified_slug
  ON subscribers (last_weekly_notified_slug);
