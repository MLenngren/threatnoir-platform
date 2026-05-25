-- Add edition support for morning/afternoon podcasts (LEN-1084)
ALTER TABLE podcast_episodes ADD COLUMN IF NOT EXISTS edition text NOT NULL DEFAULT 'morning';
ALTER TABLE podcast_episodes DROP CONSTRAINT IF EXISTS podcast_episodes_date_key;
ALTER TABLE podcast_episodes ADD CONSTRAINT podcast_episodes_date_edition_key UNIQUE (date, edition);
