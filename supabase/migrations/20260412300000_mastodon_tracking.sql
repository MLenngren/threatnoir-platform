-- Mastodon auto-post tracking (LEN-1350)

ALTER TABLE public.weekly_roundups
  ADD COLUMN IF NOT EXISTS mastodon_posted_at timestamptz;

ALTER TABLE public.focus_items
  ADD COLUMN IF NOT EXISTS mastodon_posted_at timestamptz;

