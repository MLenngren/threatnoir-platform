#!/usr/bin/env bash
set -euo pipefail

# Wrapper intended for a local/VM cron (Option A). This script does NOT call YouTube
# from Vercel; it runs locally where 1Password CLI (`op`) is available.

source "$HOME/.profile" 2>/dev/null || true

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VENV_PY="$PROJECT_DIR/venv/bin/python3"

cd "$PROJECT_DIR"

if [[ -x "$VENV_PY" ]]; then
  exec "$VENV_PY" scripts/youtube/backfill_briefings.py --limit 2
fi

exec python3 scripts/youtube/backfill_briefings.py --limit 2
