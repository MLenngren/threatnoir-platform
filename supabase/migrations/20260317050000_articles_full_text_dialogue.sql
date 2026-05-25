ALTER TABLE articles ADD COLUMN IF NOT EXISTS full_text text;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS podcast_dialogue jsonb;

COMMENT ON COLUMN articles.full_text IS 'Scraped full article body text, cleaned of HTML';
COMMENT ON COLUMN articles.podcast_dialogue IS 'Pre-generated podcast dialogue snippet (array of {speaker, text} objects)';
