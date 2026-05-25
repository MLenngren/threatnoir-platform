-- Enable RLS on ai_call_log (Supabase advisor: rls_disabled_in_public, 2026-05-20)
--
-- The original LEN-1654 migration (20260513120000_ai_call_log.sql) created the
-- table without enabling RLS, leaving SELECT/INSERT/UPDATE/DELETE open to anyone
-- with the anon key. All writes happen via service-role from server code, which
-- bypasses RLS — so no policies are needed. RLS with zero policies = deny-all
-- for anon/authenticated users.

ALTER TABLE public.ai_call_log ENABLE ROW LEVEL SECURITY;
