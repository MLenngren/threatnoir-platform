#!/bin/sh
set -eu

DB_HOST="${POSTGRES_HOST:-supabase-db}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_NAME="${POSTGRES_DB:-postgres}"
DB_USER="${POSTGRES_USER:-postgres}"

if [ -z "${POSTGRES_PASSWORD:-}" ]; then
  echo "[roles-init] POSTGRES_PASSWORD is required" >&2
  exit 1
fi
export PGPASSWORD="$POSTGRES_PASSWORD"

echo "[roles-init] waiting for Postgres at ${DB_HOST}:${DB_PORT}..."
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" >/dev/null 2>&1; do
  sleep 1
done

# Supabase's Postgres image creates the service roles during its own init scripts.
# The DB healthcheck can become healthy before those scripts finish, so we wait.
echo "[roles-init] waiting for role authenticator to exist..."
role_wait_seconds="${ROLE_INIT_TIMEOUT_SECONDS:-180}"
start_ts="$(date +%s)"
while :; do
  has_authenticator="$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "select 1 from pg_roles where rolname='authenticator'" 2>/dev/null || true)"
  if [ "${has_authenticator:-}" = "1" ]; then
    break
  fi

  now_ts="$(date +%s)"
  elapsed="$((now_ts - start_ts))"
  if [ "$elapsed" -ge "$role_wait_seconds" ]; then
    echo "[roles-init] timed out waiting for roles after ${role_wait_seconds}s" >&2
    exit 1
  fi
  sleep 2
done

echo "[roles-init] setting service role passwords to POSTGRES_PASSWORD"

# Avoid putting the password in argv. Send SQL via stdin instead.
escaped_pw="$(printf "%s" "$POSTGRES_PASSWORD" | sed "s/'/''/g")"
psql -v ON_ERROR_STOP=1 -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" >/dev/null <<SQL
DO \$\$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    EXECUTE 'ALTER ROLE authenticator WITH PASSWORD ''${escaped_pw}''';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pgbouncer') THEN
    EXECUTE 'ALTER ROLE pgbouncer WITH PASSWORD ''${escaped_pw}''';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    EXECUTE 'ALTER ROLE supabase_auth_admin WITH PASSWORD ''${escaped_pw}''';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
    EXECUTE 'ALTER ROLE supabase_storage_admin WITH PASSWORD ''${escaped_pw}''';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_functions_admin') THEN
    EXECUTE 'ALTER ROLE supabase_functions_admin WITH PASSWORD ''${escaped_pw}''';
  END IF;
END
\$\$;
SQL

echo "[roles-init] done"
