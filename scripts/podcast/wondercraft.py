"""Wondercraft TTS integration for ThreatNoir Podcast (LEN-1365).

Afternoon edition uses Wondercraft convo-mode. Morning edition remains on ElevenLabs.
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

WONDERCRAFT_BASE = "https://api.wondercraft.ai/v1"
POLL_INTERVAL_SEC = 10
POLL_TIMEOUT_SEC = 20 * 60


VOICE_MAP = {
    "alex": "rk0mQd88oviKbJAwbtS5",
    "marcus": "d7a4da75-a280-4feb-914b-1d092c9e6ffd",
}


DEFAULT_DELIVERY_INSTRUCTIONS = (
    "Alex and Marcus are good friends and experienced security practitioners "
    "recording a daily news podcast together. They know each other well, have "
    "an easy back-and-forth rhythm, and share a dry, slightly wry sense of "
    "humor. Alex leads with steady energy; Marcus is the analyst — slightly "
    "more reflective, adding context and asides. Delivery should feel like a "
    'real human conversation: natural disfluencies (occasional "uhm", '
    '"right", "yeah"), brief pauses between thoughts, soft chuckles on '
    "wry or absurd observations, no single speaker talking for too long "
    "without the other stepping in. Keep the energy steady and informed, "
    "never performative or over-acted. Do not add any content beyond the "
    "provided script — just deliver it with natural human rhythm."
)


def _eprint(*args: object) -> None:
    print(*args, file=sys.stderr)


def build_script(dialogue: dict[str, Any]) -> list[dict[str, str]]:
    """Flatten ThreatNoir dialogue JSON into Wondercraft script items."""

    out: list[dict[str, str]] = []
    for _section, speaker, text in _iter_dialogue_lines(dialogue):
        text = str(text or "").strip()
        if not text:
            continue

        voice_id = VOICE_MAP.get(str(speaker or "").strip().lower())
        if not voice_id:
            _eprint(f"[podcast] wondercraft: skipping unknown speaker={speaker!r}")
            continue

        out.append({"text": text, "voice_id": voice_id})
    return out


def _submit_job(
    client: httpx.Client,
    *,
    api_key: str,
    script: list[dict[str, str]],
    delivery_instructions: str,
) -> str:
    r = client.post(
        f"{WONDERCRAFT_BASE}/podcast/convo-mode/user-scripted",
        headers={
            "x-api-key": api_key,
            "Content-Type": "application/json",
        },
        json={
            "script": script,
            "delivery_instructions": delivery_instructions,
        },
        timeout=60,
    )
    if r.status_code >= 400:
        _eprint(f"[podcast] wondercraft: submit HTTP {r.status_code}: {r.text[:300]}")
    r.raise_for_status()
    data = r.json()
    job_id = data.get("job_id") or data.get("id")
    if not job_id:
        raise RuntimeError(f"Wondercraft submit did not return job_id: {data}")
    return str(job_id)


def _poll_job(client: httpx.Client, *, api_key: str, job_id: str) -> str:
    start = time.monotonic()
    while True:
        elapsed = int(time.monotonic() - start)
        if elapsed > POLL_TIMEOUT_SEC:
            raise RuntimeError(
                f"Wondercraft job timeout after {elapsed}s (job_id={job_id})"
            )

        r = client.get(
            f"{WONDERCRAFT_BASE}/podcast/{job_id}",
            headers={"x-api-key": api_key},
            timeout=30,
        )
        r.raise_for_status()
        data = r.json()

        finished = bool(data.get("finished"))
        error = bool(data.get("error"))
        _eprint(
            f"[podcast] wondercraft: [{elapsed:4d}s] finished={finished} error={error}"
        )

        if error:
            raise RuntimeError(
                f"Wondercraft error: {data.get('error_details') or data}"
            )
        if finished:
            url = data.get("url")
            if not url:
                raise RuntimeError(f"Wondercraft finished but no url: {data}")
            return str(url)

        time.sleep(POLL_INTERVAL_SEC)


def _download_mp3(client: httpx.Client, *, url: str, output_path: str) -> None:
    out = Path(output_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    with client.stream("GET", url, timeout=300) as r:
        r.raise_for_status()
        with open(out, "wb") as f:
            for chunk in r.iter_bytes(chunk_size=64 * 1024):
                if chunk:
                    f.write(chunk)


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


def synthesize_wondercraft(dialogue: dict[str, Any], output_path: str) -> dict:
    """Render an episode MP3 via Wondercraft convo-mode.

    Returns a dict matching the generator's expectations:
    {"duration_seconds", "output_path", "file_size_bytes", "total_characters"}
    """

    api_key = os.environ["WONDERCRAFT_API_KEY"].strip()
    if not api_key:
        raise RuntimeError("WONDERCRAFT_API_KEY is set but empty")

    script = build_script(dialogue)
    total_chars = sum(len(item.get("text", "")) for item in script)
    if not script:
        raise RuntimeError("Wondercraft script is empty after flattening dialogue")

    _eprint(
        f"[podcast] wondercraft: submitting job (lines={len(script)} chars={total_chars})"
    )

    with httpx.Client() as client:
        job_id = _submit_job(
            client,
            api_key=api_key,
            script=script,
            delivery_instructions=DEFAULT_DELIVERY_INSTRUCTIONS,
        )
        _eprint(f"[podcast] wondercraft: job_id={job_id}")

        audio_url = _poll_job(client, api_key=api_key, job_id=job_id)
        _eprint("[podcast] wondercraft: downloading mp3")
        _download_mp3(client, url=audio_url, output_path=output_path)

    file_size_bytes = Path(output_path).stat().st_size
    duration_seconds = _probe_duration_seconds(output_path)
    _eprint(
        f"[podcast] wondercraft: saved {file_size_bytes:,} bytes to {output_path} "
        f"(duration={duration_seconds}s)"
    )

    return {
        "duration_seconds": duration_seconds,
        "output_path": output_path,
        "file_size_bytes": int(file_size_bytes),
        "total_characters": int(total_chars),
    }
