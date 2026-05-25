#!/usr/bin/env python3
"""Generate atmospheric background frames for ThreatNoir video briefings.

This script calls OpenRouter's chat-completions endpoint with a Gemini image model
and saves returned base64-encoded images as 1920x1080 PNGs.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import time
from dataclasses import dataclass
from typing import Any


STYLE_SUFFIX = (
    "Dark noir aesthetic, cinematic, 1920x1080 aspect ratio, deep blue and black color palette "
    "with amber accents, atmospheric, moody, no text, no words, no letters, no writing"
)

DEFAULT_MODEL = os.getenv("OPENROUTER_MODEL", "google/gemini-3-pro-image-preview")
OPENROUTER_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions"

COST_PER_FRAME_USD = 0.013


@dataclass
class CostTracker:
    api_calls: int = 0
    total_cost_usd: float = 0.0

    def add_call(self, cost_usd: float) -> None:
        self.api_calls += 1
        self.total_cost_usd += cost_usd


def _eprint(msg: str) -> None:
    print(msg, file=sys.stderr)


def _ensure_parent_dir(path: str) -> None:
    parent = os.path.dirname(path)
    if parent:
        os.makedirs(parent, exist_ok=True)


def _build_full_prompt(visual_prompt: str) -> str:
    visual_prompt = (visual_prompt or "").strip().rstrip(".")
    if not visual_prompt:
        visual_prompt = "Atmospheric dark noir background"
    return f"{visual_prompt}. {STYLE_SUFFIX}"


def _openrouter_headers() -> dict[str, str]:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY environment variable is required")

    headers: dict[str, str] = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    # Optional OpenRouter attribution headers
    referer = os.getenv("OPENROUTER_HTTP_REFERER") or os.getenv("NUXT_PUBLIC_SITE_URL")
    if referer:
        headers["HTTP-Referer"] = referer
    headers["X-Title"] = os.getenv("OPENROUTER_APP_TITLE", "ThreatNoir Video Briefings")
    return headers


def _extract_data_url(payload: dict[str, Any]) -> str | None:
    """Return first data:image/...;base64,... URL found in response payload."""

    def scan_images_list(images: Any) -> str | None:
        if not isinstance(images, list):
            return None
        for img in images:
            if not isinstance(img, dict):
                continue
            if img.get("type") == "image_url":
                image_url = img.get("image_url")
                if isinstance(image_url, dict):
                    url = image_url.get("url")
                    if isinstance(url, str) and url.startswith("data:image"):
                        return url
        return None

    choices = payload.get("choices")
    if isinstance(choices, list) and choices:
        choice0 = choices[0] if isinstance(choices[0], dict) else None
        if choice0:
            message = choice0.get("message")
            if isinstance(message, dict):
                # OpenRouter extension used by the reference skill: message.images
                url = scan_images_list(message.get("images"))
                if url:
                    return url

                # Sometimes image parts are embedded in message.content as a list
                content = message.get("content")
                if isinstance(content, list):
                    url = scan_images_list(content)
                    if url:
                        return url

    # Fallbacks (non-standard)
    return scan_images_list(payload.get("images"))


def _decode_data_url(data_url: str) -> bytes:
    try:
        b64_part = data_url.split(",", 1)[1]
    except Exception as exc:  # pragma: no cover
        raise RuntimeError("Invalid data URL") from exc
    return base64.b64decode(b64_part)


def _save_png_1920x1080(image_bytes: bytes, output_path: str) -> None:
    """Save bytes as a 1920x1080 PNG, cover-cropping if needed."""
    from io import BytesIO

    from PIL import Image

    img = Image.open(BytesIO(image_bytes))
    img = img.convert("RGB")

    target_w, target_h = 1920, 1080
    if img.width == target_w and img.height == target_h:
        _ensure_parent_dir(output_path)
        img.save(output_path, format="PNG", optimize=True)
        return

    scale = max(target_w / img.width, target_h / img.height)
    new_w = max(1, int(round(img.width * scale)))
    new_h = max(1, int(round(img.height * scale)))
    resized = img.resize((new_w, new_h), resample=Image.Resampling.LANCZOS)

    left = max(0, (resized.width - target_w) // 2)
    top = max(0, (resized.height - target_h) // 2)
    cropped = resized.crop((left, top, left + target_w, top + target_h))

    _ensure_parent_dir(output_path)
    cropped.save(output_path, format="PNG", optimize=True)


def generate_frame(visual_prompt: str, output_path: str) -> str:
    """Generate a single background image from a visual prompt via Gemini."""
    full_prompt = _build_full_prompt(visual_prompt)

    # Lazy import so --help/--dry-run can work without deps installed.
    import httpx

    headers = _openrouter_headers()
    body = {
        "model": DEFAULT_MODEL,
        "messages": [{"role": "user", "content": full_prompt}],
    }

    with httpx.Client(timeout=httpx.Timeout(90.0)) as client:
        resp = client.post(OPENROUTER_CHAT_COMPLETIONS_URL, headers=headers, json=body)

    if resp.status_code >= 400:
        raise RuntimeError(f"OpenRouter error {resp.status_code}: {resp.text[:500]}")

    payload = resp.json()
    data_url = _extract_data_url(payload)
    if not data_url:
        raise RuntimeError("No image data found in OpenRouter response")

    image_bytes = _decode_data_url(data_url)
    _save_png_1920x1080(image_bytes, output_path)
    return output_path


def generate_frames(script: dict[str, Any], output_dir: str) -> list[str]:
    """Generate all background images for a video script."""
    segments = script.get("segments")
    if not isinstance(segments, list):
        raise ValueError("script must contain a list field 'segments'")

    os.makedirs(output_dir, exist_ok=True)
    cost = CostTracker()
    frames: list[str] = []

    for i, segment in enumerate(segments):
        seg = segment if isinstance(segment, dict) else {}
        visual_prompt = (
            seg.get("visual_prompt") or seg.get("headline") or f"Segment {i}"
        )
        output_path = os.path.join(output_dir, f"segment_{i}.png")

        if not os.path.exists(output_path):
            _generate_with_retry(str(visual_prompt), output_path, cost)

        frames.append(output_path)

    _eprint(
        f"[gemini] summary: api_calls={cost.api_calls} total_cost~${cost.total_cost_usd:.3f}"
    )

    return frames


TEMPLATES: dict[str, str] = {
    "intro-bg.png": "Dark noir cityscape at night, digital surveillance aesthetic, deep blue and black, amber city lights, atmospheric fog, cinematic, no text",
    "divider-bg.png": "Abstract dark geometric pattern, deep blue and black, minimal, subtle amber accent lines, noir aesthetic, no text",
    "closing-bg.png": "Dark noir shield emblem centered, deep blue and black background, amber glow, cinematic, atmospheric, no text",
}


def _generate_with_retry(
    visual_prompt: str, output_path: str, cost: CostTracker
) -> bool:
    try:
        # Preflight auth so we don't count non-calls as API calls.
        _openrouter_headers()
    except Exception as exc:
        _eprint(f"[gemini] WARN: cannot generate (missing config): {exc}")
        return False

    for attempt in range(2):
        try:
            cost.add_call(COST_PER_FRAME_USD)
            _eprint(
                f"[gemini] generating {output_path} (attempt {attempt + 1}/2) "
                f"cost~${COST_PER_FRAME_USD:.3f}"
            )
            generate_frame(visual_prompt, output_path)
            return True
        except Exception as exc:
            if attempt == 0:
                _eprint(f"[gemini] retrying after error: {exc}")
                time.sleep(1.0)
                continue
            _eprint(f"[gemini] WARN: failed to generate {output_path}: {exc}")
            return False
    return False


def _load_script(path: str) -> dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        raise ValueError("script JSON must be an object")
    return data


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Generate background frames via Gemini (OpenRouter)"
    )
    parser.add_argument("--script", help="Path to script JSON containing segments")
    parser.add_argument(
        "--output",
        required=True,
        help="Output directory (frames output dir, or template output dir when --generate-templates)",
    )
    parser.add_argument(
        "--dry-run", action="store_true", help="Print prompts only; do not call API"
    )
    parser.add_argument(
        "--generate-templates",
        action="store_true",
        help="Generate static template backgrounds (intro/divider/closing)",
    )

    args = parser.parse_args(argv)

    if not args.generate_templates and not args.script:
        _eprint("ERROR: --script is required unless --generate-templates is set")
        return 2

    cost = CostTracker()
    os.makedirs(args.output, exist_ok=True)

    # Templates (one-time)
    if args.generate_templates:
        for filename, prompt in TEMPLATES.items():
            out_path = os.path.join(args.output, filename)
            if args.dry_run:
                print(f"template {filename}: {_build_full_prompt(prompt)}")
                continue
            if os.path.exists(out_path):
                _eprint(f"[gemini] skip existing template: {out_path}")
                continue
            _generate_with_retry(prompt, out_path, cost)

    # Script frames
    if args.script:
        script = _load_script(args.script)
        segments = script.get("segments")
        if not isinstance(segments, list):
            _eprint("ERROR: script must contain 'segments' list")
            return 2

        for i, segment in enumerate(segments):
            seg = segment if isinstance(segment, dict) else {}
            visual_prompt = (
                seg.get("visual_prompt") or seg.get("headline") or f"Segment {i}"
            )
            visual_prompt_str = str(visual_prompt)
            out_path = os.path.join(args.output, f"segment_{i}.png")
            full_prompt = _build_full_prompt(visual_prompt_str)

            if args.dry_run:
                print(f"segment {i}: {full_prompt}")
                continue
            if os.path.exists(out_path):
                _eprint(f"[gemini] skip existing frame: {out_path}")
                continue
            _generate_with_retry(visual_prompt_str, out_path, cost)

    if not args.dry_run:
        _eprint(
            f"[gemini] summary: api_calls={cost.api_calls} total_cost~${cost.total_cost_usd:.3f}"
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
