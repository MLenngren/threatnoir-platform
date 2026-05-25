-- Per-call AI usage logging for Anthropic spend visibility (LEN-1654)

CREATE TABLE IF NOT EXISTS ai_call_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  pipeline text NOT NULL,
  model text NOT NULL,
  input_tokens int NOT NULL DEFAULT 0,
  output_tokens int NOT NULL DEFAULT 0,
  cached_input_tokens int NOT NULL DEFAULT 0,
  cache_creation_tokens int NOT NULL DEFAULT 0,
  cost_micro_cents bigint NOT NULL DEFAULT 0,
  duration_ms int,
  status text NOT NULL DEFAULT 'success',
  metadata jsonb
);

CREATE INDEX IF NOT EXISTS ai_call_log_created_at_idx ON ai_call_log (created_at DESC);
CREATE INDEX IF NOT EXISTS ai_call_log_pipeline_idx ON ai_call_log (pipeline, created_at DESC);
