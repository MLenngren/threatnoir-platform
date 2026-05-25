#!/usr/bin/env bash
# ElevenLabs Text to Dialogue standalone voice test wrapper.
# Usage: ./run_elevenlabs_dialogue_test.sh [--date YYYY-MM-DD] [--edition morning] [--confirm]
#
# Required env vars:
#   ELEVENLABS_API_KEY
#   SUPABASE_URL
#   SUPABASE_SERVICE_KEY

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VENV="$PROJECT_DIR/venv/bin/python3"

required=(ELEVENLABS_API_KEY SUPABASE_URL SUPABASE_SERVICE_KEY)
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
exec "$VENV" scripts/podcast/elevenlabs_dialogue_test.py "$@"
