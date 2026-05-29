"""ElevenLabs standalone podcast voice test (Text to Dialogue).

One-off experiment to render an existing episode's dialogue
through ElevenLabs' synchronous /v1/text-to-dialogue endpoint.

READ-ONLY: does not touch R2, does not write to Supabase, does not notify
Discord. The only external write is the ElevenLabs API call + the local MP3
file saved to --output.

Usage:
    python elevenlabs_dialogue_test.py                          # latest episode
    python elevenlabs_dialogue_test.py --date 2026-04-09 --edition morning
    python elevenlabs_dialogue_test.py --dialogue-file foo.json
    python elevenlabs_dialogue_test.py --confirm
"""

from __future__ import annotations

import argparse
import json
import os
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

import httpx

# Import the existing dialogue flattener — zero duplication.
SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))
from synthesize import _iter_dialogue_lines  # noqa: E402


def eprint(*args: object) -> None:
    print(*args, file=sys.stderr)


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

VOICE_MAP = {
    "alex": os.environ.get("ELEVENLABS_VOICE_ALEX", ""),
    "marcus": os.environ.get("ELEVENLABS_VOICE_MARCUS", ""),
}

ELEVENLABS_TEXT_TO_DIALOGUE_URL = "https://api.elevenlabs.io/v1/text-to-dialogue"
ELEVENLABS_MODEL_ID = "eleven_v3"
CHAR_CONFIRM_THRESHOLD = 10_000


# ---------------------------------------------------------------------------
# Dialogue loading (copy-pasted from wondercraft_test.py)
# ---------------------------------------------------------------------------


def load_dialogue_from_file(path: str) -> tuple[dict[str, Any], str, str]:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    date = str(data.get("date") or "unknown")
    edition = str(data.get("edition") or "file")
    return data, date, edition


def load_dialogue_from_supabase(
    date: str | None, edition: str | None
) -> tuple[dict[str, Any], str, str]:
    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_KEY", "")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")

    params = {
        "select": "date,edition,dialogue",
        "order": "date.desc,edition.desc",
        "limit": "1",
    }
    if date:
        params["date"] = f"eq.{date}"
    if edition:
        params["edition"] = f"eq.{edition}"

    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
    }

    r = httpx.get(
        f"{url}/rest/v1/podcast_episodes",
        params=params,
        headers=headers,
        timeout=30,
    )
    r.raise_for_status()
    rows = r.json()
    if not rows:
        raise RuntimeError(
            f"No podcast_episodes row found (date={date}, edition={edition})"
        )
    row = rows[0]
    dialogue = row.get("dialogue")
    if not isinstance(dialogue, dict):
        raise RuntimeError(
            f"Row {row.get('date')}/{row.get('edition')} has no dialogue JSON"
        )
    return dialogue, str(row.get("date")), str(row.get("edition") or "morning")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def build_inputs(dialogue: dict[str, Any]) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    for _section, speaker, text in _iter_dialogue_lines(dialogue):
        text = (text or "").strip()
        if not text:
            continue
        voice_id = VOICE_MAP.get((speaker or "").lower())
        if not voice_id:
            print(f"  ! skipping line with unknown speaker={speaker!r}")
            continue
        out.append({"text": text, "voice_id": voice_id})
    return out


def _probe_duration_seconds(path: str) -> int:
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "quiet",
            "-show_entries",
            "format=duration",
            "-of",
            "csv=p=0",
            path,
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    raw = (result.stdout or "").strip()
    if not raw:
        raise RuntimeError("ffprobe returned empty duration")
    return int(round(float(raw)))


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--date", default=None, help="Episode date YYYY-MM-DD")
    ap.add_argument(
        "--edition",
        default=None,
        choices=["morning", "afternoon"],
        help="Episode edition",
    )
    ap.add_argument(
        "--dialogue-file",
        default=None,
        help="Read dialogue JSON from local file instead of Supabase",
    )
    ap.add_argument(
        "--output",
        default="/tmp/elevenlabs-dialogue-test.mp3",
        help="Output MP3 path",
    )
    ap.add_argument(
        "--confirm",
        action="store_true",
        help="Confirm sending a large dialogue (>10k chars)",
    )
    args = ap.parse_args()

    api_key = os.environ.get("ELEVENLABS_API_KEY", "").strip()
    if not api_key:
        eprint("ERROR: ELEVENLABS_API_KEY not set")
        return 1

    # Load dialogue
    if args.dialogue_file:
        dialogue, date, edition = load_dialogue_from_file(args.dialogue_file)
        print(
            f"Loaded dialogue from {args.dialogue_file} (date={date}, edition={edition})"
        )
    else:
        dialogue, date, edition = load_dialogue_from_supabase(args.date, args.edition)
        print(f"Fetched dialogue from Supabase: {date} {edition}")

    # Flatten → [{text, voice_id}, ...]
    inputs = build_inputs(dialogue)
    total_chars = sum(len(s["text"]) for s in inputs)
    print(f"Script: {len(inputs)} lines, {total_chars} chars")

    if total_chars > CHAR_CONFIRM_THRESHOLD and not args.confirm:
        eprint(
            f"ERROR: {total_chars} chars exceeds {CHAR_CONFIRM_THRESHOLD} threshold. "
            "Re-run with --confirm to proceed."
        )
        return 2

    if not inputs:
        eprint("ERROR: empty script after flattening")
        return 1

    output_path = str(args.output)

    print(f"POST /v1/text-to-dialogue (model={ELEVENLABS_MODEL_ID}) ...")
    with httpx.Client() as client:
        start = time.monotonic()
        r = client.post(
            ELEVENLABS_TEXT_TO_DIALOGUE_URL,
            headers={
                "xi-api-key": api_key,
                "Content-Type": "application/json",
            },
            json={
                "inputs": inputs,
                "model_id": ELEVENLABS_MODEL_ID,
            },
            timeout=300,
        )
        elapsed = time.monotonic() - start

    if r.status_code >= 400:
        eprint(f"HTTP {r.status_code}: {r.text[:500]}")
    r.raise_for_status()

    print(f"  Response in {elapsed:.1f}s — {r.status_code} {r.reason_phrase or 'OK'}")

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "wb") as f:
        f.write(r.content)

    file_size_bytes = Path(output_path).stat().st_size
    duration_seconds = _probe_duration_seconds(output_path)
    mm = duration_seconds // 60
    ss = duration_seconds % 60

    print(f"  Saved {file_size_bytes:,} bytes to {output_path}")
    print(f"  Duration: {duration_seconds}s ({mm}:{ss:02d})")
    print(f"  Play it: mpv {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
