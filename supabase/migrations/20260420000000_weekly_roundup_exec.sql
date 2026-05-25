-- Weekly roundup enhancement: exec summary, tagline, cover image
ALTER TABLE weekly_roundups
  ADD COLUMN IF NOT EXISTS executive_summary text,
  ADD COLUMN IF NOT EXISTS tagline text,
  ADD COLUMN IF NOT EXISTS cover_image_url text;
