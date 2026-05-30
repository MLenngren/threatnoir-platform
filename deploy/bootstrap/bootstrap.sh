#!/bin/sh
set -eu

log() {
  # shellcheck disable=SC2039
  printf '%s %s\n' "[bootstrap]" "$*"
}

is_truthy() {
  case "${1:-}" in
    1|true|TRUE|yes|YES|on|ON) return 0 ;;
    *) return 1 ;;
  esac
}

is_falsy() {
  case "${1:-}" in
    0|false|FALSE|no|NO|off|OFF) return 0 ;;
    *) return 1 ;;
  esac
}

require() {
  name="$1"
  val="$(eval "printf '%s' \"\${$name:-}\"")"
  if [ -z "${val}" ]; then
    log "ERROR: ${name} is required"
    exit 1
  fi
}

require POSTGRES_PASSWORD
require SUPABASE_SERVICE_KEY
require CRON_SECRET
require APP_URL
require KONG_URL

DB_HOST="${POSTGRES_HOST:-supabase-db}"
DB_PORT="${POSTGRES_PORT:-5432}"
DB_NAME="${POSTGRES_DB:-postgres}"
DB_USER="${POSTGRES_USER:-supabase_admin}"
export PGPASSWORD="$POSTGRES_PASSWORD"

BOOTSTRAP_INGEST_RAW="${BOOTSTRAP_INGEST:-true}"
BOOTSTRAP_RUN_AI_RAW="${BOOTSTRAP_RUN_AI:-false}"

BACKFILL_HOURS_RAW="${BACKFILL_HOURS:-8}"
if printf '%s' "$BACKFILL_HOURS_RAW" | grep -Eq '^[0-9]+$' && [ "$BACKFILL_HOURS_RAW" -gt 0 ]; then
  BACKFILL_HOURS_VAL="$BACKFILL_HOURS_RAW"
else
  BACKFILL_HOURS_VAL="8"
fi

ARTICLES_INGESTED=0
ARTICLES_SUMMARIZED=0
AWARENESS_GENERATED=0
ADMIN_CREATED="false"
STATUS="success"
ERROR_MESSAGE=""
HAD_PROGRESS="0"

psql_exec() {
  psql -v ON_ERROR_STOP=1 -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" "$@"
}

insert_marker_row() {
  # Avoid writing secrets to DB; keep metadata informational only.
  metadata_json="$(jq -cn \
    --arg app_url "${APP_URL}" \
    --arg kong_url "${KONG_URL}" \
    --arg admin_email "${ADMIN_EMAIL:-}" \
    --arg bootstrap_ingest "${BOOTSTRAP_INGEST_RAW}" \
    --arg bootstrap_run_ai "${BOOTSTRAP_RUN_AI_RAW}" \
    --arg backfill_hours "${BACKFILL_HOURS_VAL}" \
    '{app_url:$app_url,kong_url:$kong_url,admin_email:$admin_email,bootstrap_ingest:$bootstrap_ingest,bootstrap_run_ai:$bootstrap_run_ai,backfill_hours:($backfill_hours|tonumber)}'
  )"

  # Note: use psql variables to keep quoting safe.
  # IMPORTANT: psql variable substitution (:'var') does NOT run for `psql -c`.
  # Feed SQL over stdin instead.
  psql \
    -v ON_ERROR_STOP=1 \
    -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    -v status="$STATUS" \
    -v articles_ingested="$ARTICLES_INGESTED" \
    -v articles_summarized="$ARTICLES_SUMMARIZED" \
    -v awareness_generated="$AWARENESS_GENERATED" \
    -v admin_created="$ADMIN_CREATED" \
    -v error="$ERROR_MESSAGE" \
    -v metadata="$metadata_json" \
    >/dev/null <<'SQL'
INSERT INTO public.system_bootstrap_runs (status, articles_ingested, articles_summarized, awareness_generated, admin_created, error, metadata)
VALUES (
  :'status',
  (:'articles_ingested')::integer,
  (:'articles_summarized')::integer,
  (:'awareness_generated')::integer,
  (:'admin_created')::boolean,
  NULLIF(:'error', ''),
  (:'metadata')::jsonb
);
SQL
}

fail() {
  ERROR_MESSAGE="$1"
  if [ "$HAD_PROGRESS" = "1" ]; then
    STATUS="partial"
  else
    STATUS="error"
  fi
  log "ERROR: $ERROR_MESSAGE"
  # Best-effort marker insert
  if insert_marker_row; then
    log "Recorded bootstrap run status=${STATUS}"
  else
    log "WARN: failed to record bootstrap run marker row"
  fi
  exit 1
}

wait_for_postgres() {
  log "Waiting for Postgres at ${DB_HOST}:${DB_PORT}..."
  max_seconds="120"
  start="$(date +%s)"
  while :; do
    if pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
      return 0
    fi
    now="$(date +%s)"
    if [ $((now - start)) -ge "$max_seconds" ]; then
      return 1
    fi
    sleep 2
  done
}

wait_for_app() {
  log "Waiting for app (${APP_URL}) to return HTTP 200..."
  max_seconds="120"
  start="$(date +%s)"
  while :; do
    code="$(curl -sS -L --max-time 5 -o /dev/null -w '%{http_code}' "$APP_URL" || true)"
    if [ "${code}" = "200" ]; then
      return 0
    fi
    now="$(date +%s)"
    if [ $((now - start)) -ge "$max_seconds" ]; then
      return 1
    fi
    sleep 2
  done
}

create_admin_user() {
  email="${ADMIN_EMAIL:-}"
  password="${ADMIN_PASSWORD:-}"
  if [ -z "$email" ] || [ -z "$password" ]; then
    log "ADMIN_EMAIL/ADMIN_PASSWORD not set; skipping admin seed"
    return 0
  fi

  log "Seeding admin user: ${email}"
  tmp="$(mktemp)"
  payload="$(jq -cn --arg email "$email" --arg password "$password" \
    '{email:$email,password:$password,email_confirm:true,app_metadata:{role:"admin"}}')"

  http_code="$(curl -sS -o "$tmp" -w '%{http_code}' \
    -X POST "${KONG_URL}/auth/v1/admin/users" \
    -H "apikey: ${SUPABASE_SERVICE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
    -H 'Content-Type: application/json' \
    --data "$payload" || true)"

  body="$(cat "$tmp" 2>/dev/null || true)"
  rm -f "$tmp"

  case "$http_code" in
    200|201)
      ADMIN_CREATED="true"
      HAD_PROGRESS="1"
      log "Admin user created"
      return 0
      ;;
    422)
      # Supabase GoTrue can return different wording depending on version.
      # Treat "email_exists" / "already registered" as idempotent success.
      if printf '%s' "$body" | grep -qi "User already registered" \
        || printf '%s' "$body" | grep -qi "email_exists" \
        || printf '%s' "$body" | grep -qi "already been registered"; then
        ADMIN_CREATED="false"
        log "Admin user already exists; continuing"
        return 0
      fi
      ;;
  esac

  log "Admin seed failed (HTTP ${http_code}). Response: ${body}"
  return 1
}

run_ingest() {
  if is_falsy "$BOOTSTRAP_INGEST_RAW"; then
    log "BOOTSTRAP_INGEST=${BOOTSTRAP_INGEST_RAW}; skipping ingest"
    return 0
  fi

  log "Backfilling articles via /api/cron/ingest (backfillHours=${BACKFILL_HOURS_VAL})"
  tmp="$(mktemp)"
  payload="$(jq -cn --argjson backfillHours "$BACKFILL_HOURS_VAL" '{backfillHours:$backfillHours}')"
  http_code="$(curl -sS -o "$tmp" -w '%{http_code}' \
    -X POST "${APP_URL}/api/cron/ingest" \
    -H "x-cron-secret: ${CRON_SECRET}" \
    -H 'Content-Type: application/json' \
    --data "$payload" || true)"
  body="$(cat "$tmp" 2>/dev/null || true)"
  rm -f "$tmp"

  if [ "$http_code" != "200" ]; then
    log "Ingest failed (HTTP ${http_code}). Response: ${body}"
    return 1
  fi

  ingested="$(printf '%s' "$body" | jq -r '.new // .created // .ingested // .inserted // 0' 2>/dev/null || echo 0)"
  if printf '%s' "$ingested" | grep -Eq '^[0-9]+$'; then
    ARTICLES_INGESTED="$ingested"
  else
    ARTICLES_INGESTED=0
  fi

  if [ "$ARTICLES_INGESTED" -gt 0 ]; then
    HAD_PROGRESS="1"
  fi
  log "Ingest complete: articles_ingested=${ARTICLES_INGESTED}"
  return 0
}

run_ai_chain() {
  if ! is_truthy "$BOOTSTRAP_RUN_AI_RAW"; then
    log "BOOTSTRAP_RUN_AI=${BOOTSTRAP_RUN_AI_RAW}; skipping AI chain"
    return 0
  fi

  # The compose ai-gateway provider requires ANTHROPIC_API_KEY to be set.
  if [ -z "${ANTHROPIC_API_KEY:-}" ] && [ -z "${AI_GATEWAY_URL:-}" ]; then
    log "WARN: BOOTSTRAP_RUN_AI=true but neither AI_GATEWAY_URL nor ANTHROPIC_API_KEY is set; skipping AI chain"
    return 0
  fi
  if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
    log "WARN: BOOTSTRAP_RUN_AI=true but ANTHROPIC_API_KEY is not set; skipping AI chain to avoid failures/cost surprises"
    return 0
  fi

  log "Running AI summarize chain (/api/cron/summarize → /api/cron/generate-awareness). This may take several minutes."

  tmp="$(mktemp)"
  http_code="$(curl -sS -o "$tmp" -w '%{http_code}' \
    -X POST "${APP_URL}/api/cron/summarize" \
    -H "x-cron-secret: ${CRON_SECRET}" \
    --max-time 1200 || true)"
  body="$(cat "$tmp" 2>/dev/null || true)"
  rm -f "$tmp"

  if [ "$http_code" != "200" ]; then
    log "Summarize failed (HTTP ${http_code}). Response: ${body}"
    return 1
  fi
  summarized="$(printf '%s' "$body" | jq -r '.processed // 0' 2>/dev/null || echo 0)"
  if printf '%s' "$summarized" | grep -Eq '^[0-9]+$'; then
    ARTICLES_SUMMARIZED="$summarized"
  else
    ARTICLES_SUMMARIZED=0
  fi
  if [ "$ARTICLES_SUMMARIZED" -gt 0 ]; then
    HAD_PROGRESS="1"
  fi
  log "Summarize complete: articles_summarized=${ARTICLES_SUMMARIZED}"

  tmp="$(mktemp)"
  http_code="$(curl -sS -o "$tmp" -w '%{http_code}' \
    -X POST "${APP_URL}/api/cron/generate-awareness" \
    -H "x-cron-secret: ${CRON_SECRET}" \
    --max-time 1200 || true)"
  body="$(cat "$tmp" 2>/dev/null || true)"
  rm -f "$tmp"

  if [ "$http_code" != "200" ]; then
    log "Generate-awareness failed (HTTP ${http_code}). Response: ${body}"
    return 1
  fi

  generated="$(printf '%s' "$body" | jq -r '.created // .generated // 0' 2>/dev/null || echo 0)"
  if printf '%s' "$generated" | grep -Eq '^[0-9]+$'; then
    AWARENESS_GENERATED="$generated"
  else
    AWARENESS_GENERATED=0
  fi
  if [ "$AWARENESS_GENERATED" -gt 0 ]; then
    HAD_PROGRESS="1"
  fi
  log "Generate-awareness complete: awareness_generated=${AWARENESS_GENERATED}"

  return 0
}

main() {
  if ! wait_for_postgres; then
    fail "Timed out waiting for Postgres"
  fi

  if ! wait_for_app; then
    fail "Timed out waiting for app to become ready"
  fi

  log "Checking previous successful bootstrap run..."
  existing="$(psql_exec -tAc "SELECT 1 FROM public.system_bootstrap_runs WHERE status = 'success' LIMIT 1;" 2>/dev/null || true)"
  if [ "${existing:-}" = "1" ]; then
    log "Previous run detected, skipping"
    exit 0
  fi

  if ! create_admin_user; then
    fail "Admin seed failed"
  fi

  if ! run_ingest; then
    fail "Ingest step failed"
  fi

  if ! run_ai_chain; then
    fail "AI chain failed"
  fi

  STATUS="success"
  ERROR_MESSAGE=""
  if insert_marker_row; then
    log "Recorded bootstrap run status=success"
  else
    fail "Failed to record bootstrap marker row"
  fi
  log "Done"
}

main
