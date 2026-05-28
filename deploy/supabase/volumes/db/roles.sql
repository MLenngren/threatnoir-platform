-- NOTE: change to your own passwords for production environments
\set pgpass `echo "$POSTGRES_PASSWORD"`

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    EXECUTE 'ALTER ROLE authenticator WITH PASSWORD ' || quote_literal(:'pgpass');
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pgbouncer') THEN
    EXECUTE 'ALTER ROLE pgbouncer WITH PASSWORD ' || quote_literal(:'pgpass');
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    EXECUTE 'ALTER ROLE supabase_auth_admin WITH PASSWORD ' || quote_literal(:'pgpass');
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_functions_admin') THEN
    EXECUTE 'ALTER ROLE supabase_functions_admin WITH PASSWORD ' || quote_literal(:'pgpass');
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
    EXECUTE 'ALTER ROLE supabase_storage_admin WITH PASSWORD ' || quote_literal(:'pgpass');
  END IF;
END
$$;
