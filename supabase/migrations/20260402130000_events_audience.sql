-- Add audience field to events for filtering by target audience
ALTER TABLE events ADD COLUMN IF NOT EXISTS audience text;
