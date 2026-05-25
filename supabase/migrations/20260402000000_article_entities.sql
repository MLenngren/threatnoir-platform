-- Add structured entities extracted during summarization
ALTER TABLE articles ADD COLUMN IF NOT EXISTS entities jsonb DEFAULT '[]'::jsonb;

