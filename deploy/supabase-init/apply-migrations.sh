#!/bin/sh
set -eu

DB_HOST="${POSTGRES_HOST:-supabase-db}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_NAME="${POSTGRES_DB:-postgres}"
DB_USER="${POSTGRES_USER:-postgres}"

if [ -z "${POSTGRES_PASSWORD:-}" ]; then
  echo "[db-init] POSTGRES_PASSWORD is required" >&2
  exit 1
fi
export PGPASSWORD="$POSTGRES_PASSWORD"

echo "[db-init] waiting for Postgres at ${DB_HOST}:${DB_PORT}..."
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" >/dev/null 2>&1; do
  sleep 1
done

# NOTE:
# Our app migrations reference Supabase Auth helpers (e.g. auth.jwt()) and may also
# reference Auth tables (e.g. auth.users). In self-hosted Supabase, those are
# created by the GoTrue (supabase-auth) service as it boots.
#
# If db-init runs before GoTrue finishes initializing its schema, migrations can
# fail with errors like "function auth.jwt() does not exist".
echo "[db-init] waiting for Supabase Auth schema (auth.users) to exist..."
auth_wait_seconds="${AUTH_INIT_TIMEOUT_SECONDS:-180}"
start_ts="$(date +%s)"
while :; do
  auth_users_regclass="$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "select to_regclass('auth.users')" 2>/dev/null || true)"
  if [ "${auth_users_regclass:-}" != "" ] && [ "${auth_users_regclass:-}" != "null" ]; then
    break
  fi

  now_ts="$(date +%s)"
  elapsed="$((now_ts - start_ts))"
  if [ "$elapsed" -ge "$auth_wait_seconds" ]; then
    echo "[db-init] timed out waiting for auth.users after ${auth_wait_seconds}s" >&2
    exit 1
  fi
  sleep 2
done

echo "[db-init] ensuring auth.jwt() exists (some migrations depend on it)"
psql -v ON_ERROR_STOP=1 -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" >/dev/null <<SQL
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb
LANGUAGE sql
STABLE
AS \$\$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
\$\$;
SQL

# If we successfully initialized this DB before, do nothing.
existing_marker="$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "select to_regclass('public._platform_db_init')")"
if [ "${existing_marker:-}" != "" ] && [ "${existing_marker:-}" != "null" ]; then
  is_complete="$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc "select complete from public._platform_db_init limit 1")"
  if [ "${is_complete:-}" = "t" ] || [ "${is_complete:-}" = "true" ]; then
    echo "[db-init] detected existing init marker (public._platform_db_init); skipping migrations"
    exit 0
  fi
fi

echo "[db-init] applying migrations from /migrations"
for f in $(ls -1 /migrations/*.sql | sort); do
  echo "[db-init] psql -f ${f##*/}"
  psql -v ON_ERROR_STOP=1 -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$f" >/dev/null
done

echo "[db-init] applying seed.sql"
psql -v ON_ERROR_STOP=1 -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f /seed.sql >/dev/null

echo "[db-init] writing init marker"
psql -v ON_ERROR_STOP=1 -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  -c "CREATE TABLE IF NOT EXISTS public._platform_db_init (complete boolean not null, completed_at timestamptz not null default now());" \
  -c "TRUNCATE public._platform_db_init;" \
  -c "INSERT INTO public._platform_db_init (complete) VALUES (true);" \
  >/dev/null

echo "[db-init] done"
