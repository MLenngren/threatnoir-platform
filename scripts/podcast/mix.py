#!/usr/bin/env python3
"""ThreatNoir Morning Podcast — mix per-line MP3s into a single episode (LEN-1079)."""

from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path
from typing import Any


def eprint(*args: object) -> None:
    print(*args, file=sys.stderr)


def _parse_section_from_filename(name: str) -> str:
    # Expected: {index}_{section}_{speaker}.mp3
    m = re.match(r"^[0-9]{3}_([^_]+)_[^_]+\.mp3$", name)
    if not m:
        return ""
    return m.group(1)


SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_BG_MUSIC = SCRIPT_DIR / "assets" / "background_music.mp3"
BG_MUSIC_DBFS = -40.0
WITHIN_SEGMENT_CROSSFADE_MS = 100


def _add_background_music(
    episode: Any, music_path: str | None = None, target_dbfs: float = BG_MUSIC_DBFS
) -> Any:
    """Loop background music underneath the episode at the target level."""
    from pydub import AudioSegment as AS

    mp = Path(music_path) if music_path else DEFAULT_BG_MUSIC
    if not mp.exists():
        eprint(f"[mix] background music not found, skipping: {mp}")
        return episode

    music = AS.from_file(str(mp))
    # Loop to fill episode length
    loops = (len(episode) // len(music)) + 1
    music_loop = (music * loops)[: len(episode)]
    # Fade in/out the music bed
    music_loop = music_loop.fade_in(2000).fade_out(3000)
    # Set level
    music_loop = _match_target_dbfs(music_loop, target_dbfs)
    music_loop = music_loop.set_channels(episode.channels).set_frame_rate(
        episode.frame_rate
    )

    # First 10 seconds at full level, then drop 30% for the rest of the episode
    fade_ms = 10_000
    if len(music_loop) > fade_ms and len(episode) > fade_ms:
        music_intro = music_loop[:fade_ms]
        music_body = _match_target_dbfs(music_loop[fade_ms:], target_dbfs - 3.5)
        music_loop = music_intro + music_body

    eprint(f"[mix] adding background music at {target_dbfs}dB (drops to {target_dbfs - 3.5}dB after 10s): {mp.name}")
    return episode.overlay(music_loop)


def _match_target_dbfs(seg: Any, target_dbfs: float) -> Any:
    """Normalize average loudness to target, with peak limiting."""
    if getattr(seg, "dBFS", None) in (None, float("-inf")):
        return seg
    change = target_dbfs - float(seg.dBFS)
    seg = seg.apply_gain(change)
    # Soft peak limit — if max peak is above -1 dBFS, pull back to prevent clipping
    peak = seg.max_dBFS
    if peak is not None and peak > -1.0:
        seg = seg.apply_gain(-1.0 - peak)
    return seg


def _smooth_clip(clip: Any, fade_ms: int = 8) -> Any:
    """Apply micro fade-in/out to eliminate click artifacts at clip boundaries.

    Uses a very short fade to avoid clipping the start/end of speech.
    Also trims leading/trailing silence to tighten conversational feel.
    """
    clip = _trim_silence(clip)
    return clip.fade_in(fade_ms).fade_out(fade_ms)


def _trim_silence(
    clip: Any, silence_thresh_db: float = -45.0, min_silence_ms: int = 80
) -> Any:
    """Trim leading and trailing silence from a clip."""
    from pydub.silence import detect_leading_silence  # type: ignore

    lead = detect_leading_silence(
        clip, silence_threshold=silence_thresh_db, chunk_size=10
    )
    # Trim trailing by reversing
    trail = detect_leading_silence(
        clip.reverse(), silence_threshold=silence_thresh_db, chunk_size=10
    )
    # Keep at least a tiny buffer so we don't clip speech
    lead = max(0, lead - 20)
    trail = max(0, trail - 20)
    end = len(clip) - trail
    if end <= lead:
        return clip
    return clip[lead:end]


def mix_episode(
    audio_dir: str, output_path: str, jingle_path: str | None = None
) -> dict:
    """Mix MP3 lines into a single episode.

    Returns {"duration_seconds": int, "output_path": str, "file_size_bytes": int}
    """

    try:
        from pydub import AudioSegment  # type: ignore
    except Exception as exc:
        raise RuntimeError(
            "Missing dependency 'pydub'. Install from scripts/podcast/requirements.txt"
        ) from exc

    audio_dir_p = Path(audio_dir)
    if not audio_dir_p.exists():
        raise FileNotFoundError(f"audio_dir does not exist: {audio_dir}")

    files = sorted(
        [p for p in audio_dir_p.iterdir() if p.is_file() and p.suffix.lower() == ".mp3"]
    )
    if not files:
        raise ValueError(f"No .mp3 files found in {audio_dir}")

    episode = AudioSegment.silent(duration=0)

    if jingle_path:
        jp = Path(jingle_path)
        if jp.exists():
            eprint(f"[mix] adding jingle: {jp}")
            episode += AudioSegment.from_file(str(jp), format="mp3")
            episode += AudioSegment.silent(duration=500)
        else:
            eprint(f"[mix] jingle not found, skipping: {jp}")

    prev_section = None
    for i, p in enumerate(files):
        section = _parse_section_from_filename(p.name)

        eprint(f"[mix] append {p.name}")
        clip = AudioSegment.from_file(str(p), format="mp3")
        # Per-line: normalize loudness, limit peaks, smooth edges
        clip = _match_target_dbfs(clip, -18.0)
        clip = _smooth_clip(clip)

        if i == 0 or prev_section is None:
            episode += clip
        elif section != prev_section:
            # Between story segments — longer pause for topic transition.
            # Filenames use sections from synthesize.py: intro, seg0..segN, closing.
            def _is_story_section(s: str | None) -> bool:
                return bool(s) and str(s).startswith("seg")

            gap_ms = (
                1200
                if _is_story_section(prev_section) and _is_story_section(section)
                else 900
            )
            episode += AudioSegment.silent(duration=gap_ms)
            episode += clip
        else:
            # Within a segment — crossfade instead of fixed silence gap
            xf = min(WITHIN_SEGMENT_CROSSFADE_MS, len(episode), len(clip))
            episode = episode.append(clip, crossfade=int(xf))

        prev_section = section

    # Background music bed
    episode = _add_background_music(episode)

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    episode.export(output_path, format="mp3", bitrate="128k")

    duration_seconds = int(round(len(episode) / 1000.0))
    file_size_bytes = os.path.getsize(output_path)

    eprint(
        f"[mix] wrote {output_path} duration={duration_seconds}s size={file_size_bytes}B"
    )
    return {
        "duration_seconds": duration_seconds,
        "output_path": output_path,
        "file_size_bytes": file_size_bytes,
    }


def parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Mix per-line MP3s into a single podcast episode"
    )
    p.add_argument("--audio-dir", required=True, help="Directory of per-line MP3s")
    p.add_argument("--output", required=True, help="Output MP3 path")
    p.add_argument("--jingle", help="Optional jingle MP3 path")
    return p.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    mix_episode(
        str(args.audio_dir), str(args.output), str(args.jingle) if args.jingle else None
    )
    return 0


if __name__ == "__main__":  # pragma: no cover
    try:
        raise SystemExit(main(sys.argv[1:]))
    except BrokenPipeError:
        raise
    except Exception as exc:
        eprint(f"[mix] ERROR: {exc}")
        raise SystemExit(1)
