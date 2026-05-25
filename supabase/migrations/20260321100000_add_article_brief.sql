ALTER TABLE articles ADD COLUMN IF NOT EXISTS brief text;

COMMENT ON COLUMN articles.brief IS 'One-liner summary, max ~120 chars. Generated during summarization.';

