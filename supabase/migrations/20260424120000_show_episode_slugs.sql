-- LEN-1566: Add per-episode slugs + summaries for Red vs Blue Show episodes

-- 1) Columns
ALTER TABLE public.video_briefings
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS summary text;

-- 2) Uniqueness + lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_video_briefings_slug
  ON public.video_briefings (slug)
  WHERE slug IS NOT NULL;

-- 2b) Auto-generate slug on insert/update when missing (allows manual override).
CREATE OR REPLACE FUNCTION public.set_video_briefings_slug()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  base_slug text;
  candidate text;
BEGIN
  IF NEW.slug IS NOT NULL AND btrim(NEW.slug) <> '' THEN
    RETURN NEW;
  END IF;

  -- Ensure NEW.id exists for deterministic hash fallback.
  IF NEW.id IS NULL THEN
    NEW.id := gen_random_uuid();
  END IF;

  base_slug := lower(
    regexp_replace(
      regexp_replace(
        regexp_replace(coalesce(NEW.title, ''), '[^a-zA-Z0-9]+', '-', 'g'),
        '(^-+)|(-+$)',
        '',
        'g'
      ),
      '-+',
      '-',
      'g'
    )
  );
  IF base_slug IS NULL OR base_slug = '' THEN
    base_slug := 'episode';
  END IF;

  candidate := base_slug;
  IF EXISTS (SELECT 1 FROM public.video_briefings vb WHERE vb.slug = candidate AND vb.id <> NEW.id) THEN
    candidate := base_slug || '-' || to_char(NEW.date, 'YYYY-MM-DD');
  END IF;
  IF EXISTS (SELECT 1 FROM public.video_briefings vb WHERE vb.slug = candidate AND vb.id <> NEW.id) THEN
    candidate := base_slug || '-' || to_char(NEW.date, 'YYYY-MM-DD') || '-' || substring(md5(NEW.id::text) from 1 for 6);
  END IF;

  NEW.slug := candidate;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_video_briefings_slug ON public.video_briefings;
CREATE TRIGGER set_video_briefings_slug
  BEFORE INSERT OR UPDATE OF title, date, slug ON public.video_briefings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_video_briefings_slug();

-- 3) Backfill slugs for existing rows.
-- Rules:
-- - Base: kebab-case from title (lowercase, strip punctuation/diacritics, collapse runs)
-- - If collision: append -YYYY-MM-DD from date
-- - If still collision: append short hash
WITH pending AS (
  SELECT
    id,
    date,
    COALESCE(NULLIF(
      lower(
        regexp_replace(
          regexp_replace(
            -- Keep ASCII alphanumerics; everything else becomes a dash.
            trim(title),
            '[^a-zA-Z0-9]+',
            '-',
            'g'
          ),
          '(^-+)|(-+$)',
          '',
          'g'
        )
      ),
      ''
    ), 'episode') AS base_slug
  FROM public.video_briefings
  WHERE slug IS NULL
),
existing AS (
  SELECT slug
  FROM public.video_briefings
  WHERE slug IS NOT NULL
),
step1 AS (
  SELECT
    p.*,
    (p.base_slug || '-' || to_char(p.date, 'YYYY-MM-DD')) AS date_slug,
    (p.base_slug || '-' || to_char(p.date, 'YYYY-MM-DD') || '-' || substring(md5(p.id::text) from 1 for 6)) AS hash_slug,
    count(*) OVER (PARTITION BY p.base_slug) AS base_dup_cnt,
    EXISTS (SELECT 1 FROM existing e WHERE e.slug = p.base_slug) AS base_taken
  FROM pending p
),
step2 AS (
  SELECT
    s1.*,
    CASE
      WHEN s1.base_dup_cnt = 1 AND NOT s1.base_taken THEN s1.base_slug
      ELSE s1.date_slug
    END AS cand1
  FROM step1 s1
),
step3 AS (
  SELECT
    s2.*,
    count(*) OVER (PARTITION BY s2.cand1) AS cand1_dup_cnt,
    EXISTS (SELECT 1 FROM existing e WHERE e.slug = s2.cand1) AS cand1_taken
  FROM step2 s2
),
final AS (
  SELECT
    id,
    CASE
      WHEN cand1_dup_cnt = 1 AND NOT cand1_taken THEN cand1
      ELSE hash_slug
    END AS final_slug
  FROM step3
)
UPDATE public.video_briefings vb
SET slug = f.final_slug
FROM final f
WHERE vb.id = f.id
  AND vb.slug IS NULL;
