#!/usr/bin/env bash
# Generate a LinkedIn weekly draft from the latest roundup.
# Usage: ./run_weekly_draft.sh [output_dir] [--script-args...]
#
# Required env vars:
#   ANTHROPIC_API_KEY
#   SUPABASE_URL
#   SUPABASE_SERVICE_KEY

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VENV="$PROJECT_DIR/venv/bin/python3"

required=(ANTHROPIC_API_KEY SUPABASE_URL SUPABASE_SERVICE_KEY)
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
