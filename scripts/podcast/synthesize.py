#!/usr/bin/env python3
"""Morning Podcast — synthesize dialogue lines to MP3 via TTS (LEN-1078).

Supports OpenAI TTS and ElevenLabs engines (swappable via engine parameter).
ElevenLabs uses context-aware synthesis (previous_text/next_text) for natural
conversational flow.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Any


# --- Engine configs ---

OPENAI_VOICES: dict[str, str] = {
    "alex": "ash",
    "marcus": "echo",
}
OPENAI_MODEL = "gpt-4o-mini-tts"
OPENAI_USD_PER_1K_CHARS = 0.015

OPENAI_SPEAKER_INSTRUCTIONS: dict[str, str] = {
    "alex": "You are Alex, a sharp cybersecurity news anchor. Speak clearly and directly with energy, like a tech podcast host. Conversational but authoritative.",
    "marcus": "You are Marcus, a seasoned security practitioner and co-host. Speak in a warm, conversational tone with natural pacing. Confident and knowledgeable.",
}

# Voice IDs for the two podcast hosts. Get from your ElevenLabs Voice Library
# (https://elevenlabs.io/app/voice-library) and set via env vars:
#   ELEVENLABS_VOICE_ALEX, ELEVENLABS_VOICE_MARCUS
ELEVENLABS_VOICES: dict[str, str] = {
    "alex": os.environ.get("ELEVENLABS_VOICE_ALEX", ""),
    "marcus": os.environ.get("ELEVENLABS_VOICE_MARCUS", ""),
}
ELEVENLABS_MODEL = "eleven_multilingual_v2"
ELEVENLABS_USD_PER_1K_CHARS = 0.018

# Per-speaker voice tuning
ELEVENLABS_SPEAKER_SETTINGS: dict[str, dict[str, Any]] = {
    "alex": {
        "stability": 0.40,
        "similarity_boost": 0.80,
        "style": 0.20,
        "use_speaker_boost": True,
        "speed": 0.90,
    },
    "marcus": {
        "stability": 0.30,
        "similarity_boost": 0.75,
        "style": 0.30,
        "use_speaker_boost": True,
        "speed": 1.0,
    },
}

ENGINE_VOICES: dict[str, dict[str, str]] = {
    "openai": OPENAI_VOICES,
    "elevenlabs": ELEVENLABS_VOICES,
}
ENGINE_COST: dict[str, float] = {
    "openai": OPENAI_USD_PER_1K_CHARS,
    "elevenlabs": ELEVENLABS_USD_PER_1K_CHARS,
}
DEFAULT_ENGINE = "elevenlabs"


def eprint(*args: object) -> None:
    print(*args, file=sys.stderr)


def _load_json(path: str) -> Any:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _ensure_dir(path: str) -> None:
    Path(path).mkdir(parents=True, exist_ok=True)


def _sanitize_tts_text(text: str) -> str:
    """Small safety net for TTS-unfriendly cutoffs.

    The dialogue generator is prompted not to output trailing em dashes, but LLMs
    sometimes disobey. Trailing em dashes often render as abrupt stops.
    """

    t = (text or "").rstrip()
    # Strip any XML/SSML tags to prevent TTS injection (ElevenLabs supports SSML).
    t = re.sub(r"<[^>]+>", "", t)
    while t.endswith("—"):
        t = t[:-1].rstrip()
    return t


# ---------------------------------------------------------------------------
# OpenAI TTS backend
# ---------------------------------------------------------------------------


def _openai_client() -> Any:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set")

    try:
        from openai import OpenAI  # type: ignore
    except Exception as exc:
        raise RuntimeError(
            "Missing dependency 'openai'. Install from scripts/podcast/requirements.txt"
        ) from exc

    return OpenAI(api_key=api_key)


def _synthesize_openai(
    text: str, voice: str, output_path: str, *, speaker: str | None = None
) -> None:
    client = _openai_client()
    kwargs: dict[str, Any] = {
        "model": OPENAI_MODEL,
        "input": text,
        "voice": voice,
        "response_format": "mp3",
    }
    if speaker and speaker in OPENAI_SPEAKER_INSTRUCTIONS:
        kwargs["instructions"] = OPENAI_SPEAKER_INSTRUCTIONS[speaker]

    resp = client.audio.speech.create(**kwargs)
    if hasattr(resp, "stream_to_file"):
        resp.stream_to_file(output_path)
    elif hasattr(resp, "write_to_file"):
        resp.write_to_file(output_path)
    else:
        data = getattr(resp, "content", None)
        if not isinstance(data, (bytes, bytearray)):
            raise RuntimeError("Unexpected OpenAI TTS response type")
        with open(output_path, "wb") as f:
            f.write(data)


# ---------------------------------------------------------------------------
# ElevenLabs TTS backend — context-aware synthesis
# ---------------------------------------------------------------------------


def _elevenlabs_client() -> Any:
    api_key = os.environ.get("ELEVENLABS_API_KEY")
    if not api_key:
        raise RuntimeError("ELEVENLABS_API_KEY is not set")

    try:
        from elevenlabs.client import ElevenLabs  # type: ignore
    except Exception as exc:
        raise RuntimeError(
            "Missing dependency 'elevenlabs'. pip install elevenlabs"
        ) from exc

    return ElevenLabs(api_key=api_key)


def _classify_line_type(text: str, section: str | None = None) -> str:
    """Classify a dialogue line for TTS tuning."""
    t = text.lower().strip()
    # Short reactions
    if len(t) < 30 and any(
        t.startswith(w)
        for w in (
            "right",
            "wow",
            "hmm",
            "yeah",
            "exactly",
            "wait",
            "hold on",
            "okay",
            "fair",
            "true",
            "interesting",
            "huh",
        )
    ):
        return "reaction"
    # Questions
    if text.rstrip().endswith("?"):
        return "question"
    # Emotional / opinionated
    if any(
        w in t
        for w in (
            "worries me",
            "overhyped",
            "wild",
            "scary",
            "honestly",
            "i don't know",
            "that's huge",
            "not great",
            "actually worries",
            "the thing is",
            "look,",
            "come on",
        )
    ):
        return "emotional"
    # Default
    return "explanation"


# Override settings per line type — merged on top of speaker base settings
LINE_TYPE_OVERRIDES: dict[str, dict[str, float]] = {
    "reaction": {"stability": 0.25, "style": 0.40},
    "question": {"stability": 0.30, "style": 0.35},
    "emotional": {"stability": 0.28, "style": 0.38},
    "explanation": {"stability": 0.50, "style": 0.15},
}


def _synthesize_elevenlabs(
    text: str,
    voice_id: str,
    output_path: str,
    *,
    speaker: str | None = None,
    previous_text: str | None = None,
    next_text: str | None = None,
) -> None:
    """Render one line with ElevenLabs, using per-speaker settings and context."""
    import httpx

    api_key = os.environ.get("ELEVENLABS_API_KEY")
    if not api_key:
        raise RuntimeError("ELEVENLABS_API_KEY is not set")

    # Per-speaker voice settings (with speed support via REST API)
    settings = ELEVENLABS_SPEAKER_SETTINGS.get(speaker or "", {})

    # Dynamic settings based on line content
    line_type = _classify_line_type(text, section=None)
    type_overrides = LINE_TYPE_OVERRIDES.get(line_type, {})

    voice_settings = {
        "stability": type_overrides.get("stability", settings.get("stability", 0.35)),
        "similarity_boost": settings.get("similarity_boost", 0.80),
        "style": type_overrides.get("style", settings.get("style", 0.15)),
        "use_speaker_boost": settings.get("use_speaker_boost", True),
    }

    eprint(
        f"  [tts] line_type={line_type} stability={voice_settings['stability']:.2f} style={voice_settings['style']:.2f}"
    )

    body: dict[str, Any] = {
        "text": text,
        "model_id": ELEVENLABS_MODEL,
        "voice_settings": voice_settings,
        "output_format": "mp3_44100_128",
    }

    if settings.get("speed"):
        body["voice_settings"]["speed"] = settings["speed"]

    if previous_text:
        body["previous_text"] = previous_text
    if next_text:
        body["next_text"] = next_text

    resp = httpx.post(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
        headers={"xi-api-key": api_key, "Content-Type": "application/json"},
        json=body,
        timeout=60.0,
    )
    if resp.status_code >= 400:
        raise RuntimeError(
            f"ElevenLabs API error {resp.status_code}: {resp.text[:200]}"
        )
    with open(output_path, "wb") as f:
        f.write(resp.content)


# ---------------------------------------------------------------------------
# Unified synthesis interface
# ---------------------------------------------------------------------------


def synthesize_line(
    text: str,
    voice: str,
    output_path: str,
    engine: str = DEFAULT_ENGINE,
    *,
    speaker: str | None = None,
    previous_text: str | None = None,
    next_text: str | None = None,
) -> str:
    """Render one line to MP3. Returns output_path."""
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    if engine == "openai":
        _synthesize_openai(text, voice, output_path, speaker=speaker)
    elif engine == "elevenlabs":
        _synthesize_elevenlabs(
            text,
            voice,
            output_path,
            speaker=speaker,
            previous_text=previous_text,
            next_text=next_text,
        )
    else:
        raise ValueError(f"Unknown engine '{engine}'. Use 'openai' or 'elevenlabs'.")

    return output_path


# ---------------------------------------------------------------------------
# Dialogue iteration and batch synthesis
# ---------------------------------------------------------------------------


def _iter_dialogue_lines(dialogue: dict[str, Any]) -> list[tuple[str, str, str]]:
    """Return ordered (section, speaker, text) tuples."""

    out: list[tuple[str, str, str]] = []

    for row in dialogue.get("intro") or []:
        if isinstance(row, dict):
            out.append(
                ("intro", str(row.get("speaker") or ""), str(row.get("text") or ""))
            )

    segs = dialogue.get("segments") or []
    if isinstance(segs, list):
        for i, seg in enumerate(segs):
            if not isinstance(seg, dict):
                continue
            for row in seg.get("dialogue") or []:
                if isinstance(row, dict):
                    out.append(
                        (
                            f"seg{i}",
                            str(row.get("speaker") or ""),
                            str(row.get("text") or ""),
                        )
                    )

    for row in dialogue.get("closing") or []:
        if isinstance(row, dict):
            out.append(
                ("closing", str(row.get("speaker") or ""), str(row.get("text") or ""))
            )

    return out


def synthesize_dialogue(
    dialogue: dict[str, Any], output_dir: str, engine: str = DEFAULT_ENGINE
) -> tuple[list[str], int]:
    """Render all lines with context-aware synthesis. Returns (ordered MP3 paths, total_characters)."""

    voice_map = ENGINE_VOICES.get(engine)
    if voice_map is None:
        raise ValueError(f"Unknown engine '{engine}'. Use 'openai' or 'elevenlabs'.")

    _ensure_dir(output_dir)
    output_dir_p = Path(output_dir)

    ordered_paths: list[str] = []
    total_chars = 0

    lines = _iter_dialogue_lines(dialogue)
    if not lines:
        raise ValueError("No dialogue lines found")

    # Pre-extract texts for context window (also sanitize for TTS)
    texts = [_sanitize_tts_text((t or "").strip()) for (_, _, t) in lines]

    for idx, (section, speaker, text) in enumerate(lines):
        speaker_norm = speaker.strip().lower()
        if speaker_norm not in voice_map:
            raise ValueError(f"Unknown speaker '{speaker}' for engine '{engine}'")
        voice = voice_map[speaker_norm]

        text_norm = texts[idx]
        if not text_norm:
            continue

        # Build context from surrounding lines (regardless of speaker —
        # the model uses this to understand conversational flow)
        prev_text = texts[idx - 1] if idx > 0 else None
        next_text = texts[idx + 1] if idx < len(texts) - 1 else None

        total_chars += len(text_norm)
        filename = f"{idx:03d}_{section}_{speaker_norm}.mp3"
        path = str(output_dir_p / filename)

        eprint(f"[tts] {filename} voice={voice} chars={len(text_norm)} engine={engine}")
        synthesize_line(
            text_norm,
            voice,
            path,
            engine=engine,
            speaker=speaker_norm,
            previous_text=prev_text,
            next_text=next_text,
        )
        ordered_paths.append(path)

    return ordered_paths, total_chars


def estimate_tts_cost_usd(total_characters: int, engine: str = DEFAULT_ENGINE) -> float:
    cost_per_1k = ENGINE_COST.get(engine, OPENAI_USD_PER_1K_CHARS)
    return (total_characters / 1000.0) * cost_per_1k


def parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(
	        description="Synthesize podcast dialogue to MP3"
    )
    p.add_argument("--dialogue", required=True, help="Path to dialogue JSON")
    p.add_argument(
        "--output", required=True, help="Output directory for per-line MP3 files"
    )
    p.add_argument(
        "--engine",
        default=DEFAULT_ENGINE,
        help=f"TTS engine (default: {DEFAULT_ENGINE})",
    )
    return p.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    dialogue = _load_json(str(args.dialogue))
    if not isinstance(dialogue, dict):
        raise ValueError("Dialogue JSON must be an object")

    audio_files, total_chars = synthesize_dialogue(
        dialogue=dialogue, output_dir=str(args.output), engine=str(args.engine)
    )
    cost = estimate_tts_cost_usd(total_chars, engine=str(args.engine))
    eprint(
        f"[tts] lines={len(audio_files)} total_chars={total_chars} engine={args.engine} est_cost=${cost:.4f}"
    )
    return 0


if __name__ == "__main__":  # pragma: no cover
    try:
        raise SystemExit(main(sys.argv[1:]))
    except BrokenPipeError:
        raise
    except Exception as exc:
        eprint(f"[tts] ERROR: {exc}")
        raise SystemExit(1)
