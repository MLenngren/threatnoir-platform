CREATE TABLE IF NOT EXISTS public.system_bootstrap_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL CHECK (status IN ('success', 'partial', 'error')),
  articles_ingested integer DEFAULT 0,
  articles_summarized integer DEFAULT 0,
  awareness_generated integer DEFAULT 0,
  admin_created boolean DEFAULT false,
  error text,
  metadata jsonb
);

ALTER TABLE public.system_bootstrap_runs ENABLE ROW LEVEL SECURITY;
