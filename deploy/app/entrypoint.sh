#!/bin/sh
set -eu

# Nuxt runtime uses NUXT_PUBLIC_SUPABASE_URL (defaulting to http://localhost:${SUPABASE_KONG_PORT}).
# Inside the app container, "localhost" would normally point back to itself, so server-side
# Supabase calls would fail. We run a local TCP proxy to forward that port to supabase-kong:8000.

LOCAL_PORT="${SUPABASE_KONG_PORT:-7100}"
TARGET_HOST="${SUPABASE_KONG_INTERNAL_HOST:-supabase-kong}"
TARGET_PORT="${SUPABASE_KONG_INTERNAL_PORT:-8000}"

# Best-effort: start proxy; if it fails, continue (Nuxt may still work if public URL is routable).
socat "TCP-LISTEN:${LOCAL_PORT},fork,reuseaddr" "TCP:${TARGET_HOST}:${TARGET_PORT}" >/dev/null 2>&1 &

exec node .output/server/index.mjs