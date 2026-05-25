-- LEN-1098: Store accompanying written article for each podcast episode
ALTER TABLE podcast_episodes ADD COLUMN IF NOT EXISTS article_text TEXT;
