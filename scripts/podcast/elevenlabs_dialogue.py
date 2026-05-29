"""ElevenLabs Text to Dialogue integration for podcast generation (LEN-1367).

Morning edition uses the /v1/text-to-dialogue API (model eleven_v3) which
returns a full multi-speaker conversation as one unified MP3. This replaces
the per-line synthesize_dialogue() + mix_episode() pipeline and eliminates
boundary artifacts (LEN-1328).
"""

from __future__ import annotations

import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

import httpx

from synthesize import _iter_dialogue_lines

ELEVENLABS_TEXT_TO_DIALOGUE_URL = "https://api.elevenlabs.io/v1/text-to-dialogue"
ELEVENLABS_MODEL_ID = "eleven_v3"
HTTP_TIMEOUT_SEC = 300

# Voice IDs from your ElevenLabs Voice Library — set via env vars.
VOICE_MAP = {
    "alex": os.environ.get("ELEVENLABS_VOICE_ALEX", ""),
    "marcus": os.environ.get("ELEVENLABS_VOICE_MARCUS", ""),
}


def _eprint(*args: object) -> None:
    print(*args, file=sys.stderr)


def build_inputs(dialogue: dict[str, Any]) -> list[dict[str, str]]:
    """Flatten dialogue JSON into ElevenLabs input items."""

    out: list[dict[str, str]] = []
    for _section, speaker, text in _iter_dialogue_lines(dialogue):
        text = str(text or "").strip()
        if not text:
            continue

        voice_id = VOICE_MAP.get(str(speaker or "").strip().lower())
        if not voice_id:
            _eprint(
                f"[podcast] elevenlabs-dialogue: skipping unknown speaker={speaker!r}"
            )
            continue

        out.append({"text": text, "voice_id": voice_id})
    return out


def _probe_duration_seconds(path: str) -> int:
    cmd = [
        "ffprobe",
        "-v",
        "quiet",
        "-show_entries",
        "format=duration",
        "-of",
        "csv=p=0",
        path,
    ]
    r = subprocess.run(cmd, capture_output=True, text=True, check=True)
    raw = (r.stdout or "").strip()
    if not raw:
        raise RuntimeError("ffprobe returned empty duration")
    return int(round(float(raw)))


def synthesize_elevenlabs_dialogue(dialogue: dict[str, Any], output_path: str) -> dict:
    """Render an episode MP3 via ElevenLabs /v1/text-to-dialogue (eleven_v3).

    Returns a dict matching the generator's expectations:
    {"duration_seconds", "output_path", "file_size_bytes", "total_characters"}
    """

    api_key = os.environ["ELEVENLABS_API_KEY"].strip()
    if not api_key:
        raise RuntimeError("ELEVENLABS_API_KEY is set but empty")

    inputs = build_inputs(dialogue)
    total_chars = sum(len(item.get("text", "")) for item in inputs)
    if not inputs:
        raise RuntimeError("ElevenLabs dialogue inputs are empty after flattening")

    _eprint(
        f"[podcast] elevenlabs-dialogue: submitting (lines={len(inputs)} chars={total_chars})"
    )

    start = time.monotonic()
    with httpx.Client() as client:
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
            timeout=HTTP_TIMEOUT_SEC,
        )

    if r.status_code >= 400:
        _eprint(f"[podcast] elevenlabs-dialogue: HTTP {r.status_code}: {r.text[:500]}")
    r.raise_for_status()

    elapsed = time.monotonic() - start
    _eprint(f"[podcast] elevenlabs-dialogue: response in {elapsed:.1f}s")

    out = Path(output_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, "wb") as f:
        f.write(r.content)

    file_size_bytes = out.stat().st_size
    duration_seconds = _probe_duration_seconds(output_path)
    _eprint(
        f"[podcast] elevenlabs-dialogue: saved {file_size_bytes:,} bytes to {output_path} "
        f"(duration={duration_seconds}s)"
    )

    return {
        "duration_seconds": duration_seconds,
        "output_path": output_path,
        "file_size_bytes": int(file_size_bytes),
        "total_characters": int(total_chars),
    }
