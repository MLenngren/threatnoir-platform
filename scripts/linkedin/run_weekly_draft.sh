#!/usr/bin/env bash
set -euo pipefail

: "${SUPABASE_PROJECT_REF:?SUPABASE_PROJECT_REF env var required}"

source "$HOME/.profile" 2>/dev/null || true

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VENV="$PROJECT_DIR/venv/bin/python3"

export ANTHROPIC_API_KEY="$(op read "op://Claude/Anthropic/api_key")"
export SUPABASE_URL="https://${SUPABASE_PROJECT_REF}.supabase.co"
PAT="$(op read "op://Claude/Supabase/PAT")"
export SUPABASE_SERVICE_KEY="$(curl -s "https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/api-keys" \
  -H "Authorization: Bearer $PAT" | python3 -c "import json,sys; keys=json.load(sys.stdin); print([k['api_key'] for k in keys if k['name']=='service_role'][0])")"

OUTPUT_DIR="${1:-/tmp/linkedin-draft}"
mkdir -p "$OUTPUT_DIR"

cd "$PROJECT_DIR"
"$VENV" scripts/linkedin/generate_weekly_draft.py --output-dir "$OUTPUT_DIR" "${@:2}"

echo ""
echo "=== LinkedIn Draft Ready ==="
echo "Post text: $OUTPUT_DIR/post.txt"
echo "Card image: $OUTPUT_DIR/card.png"
echo ""
cat "$OUTPUT_DIR/post.txt"

