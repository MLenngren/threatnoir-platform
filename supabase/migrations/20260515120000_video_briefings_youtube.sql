-- LEN-1761: YouTube publishing metadata for video_briefings (SOC briefings)

ALTER TABLE public.video_briefings
  ADD COLUMN IF NOT EXISTS youtube_video_id text,
  ADD COLUMN IF NOT EXISTS youtube_url text,
  ADD COLUMN IF NOT EXISTS youtube_uploaded_at timestamptz;

CREATE INDEX IF NOT EXISTS video_briefings_youtube_video_id_idx
  ON public.video_briefings (youtube_video_id)
  WHERE youtube_video_id IS NOT NULL;
