-- Add slug column for shareable awareness lesson URLs (LEN-1218)
ALTER TABLE awareness_lessons ADD COLUMN IF NOT EXISTS slug text UNIQUE;
CREATE INDEX IF NOT EXISTS idx_awareness_lessons_slug ON awareness_lessons(slug) WHERE slug IS NOT NULL;

-- Backfill slugs from titles (handles duplicates with row number suffix)
WITH slugged AS (
  SELECT id,
    lower(regexp_replace(regexp_replace(trim(title), '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g')) AS base_slug,
    ROW_NUMBER() OVER (
      PARTITION BY lower(regexp_replace(regexp_replace(trim(title), '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'))
      ORDER BY created_at
    ) AS rn
  FROM awareness_lessons
  WHERE slug IS NULL AND title IS NOT NULL
)
UPDATE awareness_lessons
SET slug = CASE WHEN slugged.rn = 1 THEN slugged.base_slug ELSE slugged.base_slug || '-' || slugged.rn END
FROM slugged
WHERE awareness_lessons.id = slugged.id;
