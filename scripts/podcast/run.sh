#!/usr/bin/env bash
# Podcast — cron wrapper
# Runs the daily podcast generation pipeline.
#
# Usage: 0 6 * * * /path/to/your-project/scripts/podcast/run.sh >> /tmp/podcast.log 2>&1
#        0 14 * * * /path/to/your-project/scripts/podcast/run.sh --edition afternoon >> /tmp/podcast.log 2>&1
#
# Required env vars (set in the shell environment that invokes this script):
#   ELEVENLABS_API_KEY        — for podcast TTS narration
#   WONDERCRAFT_API_KEY       — for podcast mastering (optional, comment out wondercraft step if unused)
#   OPENAI_API_KEY            — for embeddings / fallback model
#   ANTHROPIC_API_KEY         — for script generation (Claude)
#   R2_ACCESS_KEY_ID          — Cloudflare R2 (or S3-compatible) for audio hosting
#   R2_SECRET_ACCESS_KEY
#   R2_ENDPOINT
#   SUPABASE_URL              — your Supabase project URL
#   SUPABASE_SERVICE_KEY      — Supabase service role key (server-side)
#   DISCORD_BOT_TOKEN         — optional, for Discord notifications
#   DISCORD_ALERTS_CHANNEL_ID — optional, target channel for notifications
#
# Tip: source these from a secret manager (e.g. 1Password CLI, AWS Secrets Manager,
# Doppler, or a gitignored .env file with `set -a; source .env; set +a`) before
# invoking this script — never commit real secrets to the repo.

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VENV="$PROJECT_DIR/venv/bin/python3"

# Sanity-check the required env vars are present
required=(ELEVENLABS_API_KEY ANTHROPIC_API_KEY R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_ENDPOINT SUPABASE_URL SUPABASE_SERVICE_KEY)
missing=()
for var in "${required[@]}"; do
    if [ -z "${!var:-}" ]; then
        missing+=("$var")
    fi
done
if [ ${#missing[@]} -gt 0 ]; then
    echo "ERROR: Missing required env vars: ${missing[*]}" >&2
    exit 1
fi

cd "$PROJECT_DIR"
exec "$VENV" scripts/podcast/generate.py "$@"
