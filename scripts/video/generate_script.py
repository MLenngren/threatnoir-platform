#!/usr/bin/env python3
"""Video briefing script generator.

Reads a JSON list of articles (from stdin or --articles file) and asks Claude to
produce a structured narration script JSON for Remotion.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from dataclasses import dataclass
from datetime import date as date_type
from typing import Any

# Ensure repo root is on sys.path so we can import scripts/utils when this file is
# executed directly (e.g. `python scripts/video/generate_script.py`).
_d = os.path.abspath(os.path.dirname(__file__))
while os.path.basename(_d) != "scripts" and _d != os.path.dirname(_d):
    _d = os.path.dirname(_d)
_project_root = os.path.dirname(_d)
if _project_root and _project_root not in sys.path:
    sys.path.insert(0, _project_root)

from scripts.utils.ai_cost import log_ai_call  # noqa: E402


MODEL = "claude-haiku-4-5-20251001"
TEMPERATURE = 0.7

# Anthropic pricing (USD) for Haiku.
HAIKU_INPUT_USD_PER_MTOK = 0.80
HAIKU_OUTPUT_USD_PER_MTOK = 4.00

# These are *not* exposed in the output schema, but are used to compute
# estimated_duration_seconds.
INTRO_SECONDS = 10
CLOSING_SECONDS = 8


SYSTEM_PROMPT_COMMON = """You are a daily security video briefing script writer.

Return ONLY valid JSON. Do not wrap in markdown. Do not include code fences. Do not include commentary.

Your task:
- You will receive a date, an audience type, and a list of security news articles.
- Select the most important stories (typically 5–8) for a short video briefing.
- Produce a single JSON object that matches the EXACT schema described below. Do not add extra keys.

Output JSON schema (exact keys, types):
{
  "audience": "executive" | "soc" | "engineer",
  "date": "YYYY-MM-DD",
	  "title": "Daily Briefing — <Audience>",
  "intro": {
    "text": "...",
    "visual_prompt": "..."
  },
  "segments": [
    {
      "headline": "...",
      "narration": "...",
      "impact_cards": [
        {"label": "WHY CARE", "value": "Legacy systems and vendors under attack"},
        {"label": "AFFECTED", "value": "200K+ customer records"},
        {"label": "ACTION", "value": "Patch immediately"}
      ],
      "key_points": ["..."],
      "visual_prompt": "...",
      "source_article_id": "<id from input>",
      "display_seconds": 8
    }
  ],
  "closing": {
    "text": "...",
    "visual_prompt": "..."
  },
  "estimated_duration_seconds": 150
}

Rules:
- The JSON MUST be parseable.
- Use ONLY article facts present in the provided article fields. If details are missing, keep claims general.
- For each segment:
  - headline: short, punchy, derived from the article title. Max 10 words.
  - narration: ONE short sentence (max 15 words) summarizing the story. This appears as a subtitle.
  - impact_cards: EXACTLY 2-3 cards. Each card has a short "label" and concise "value".
    * Labels should be punchy like: WHY CARE, AFFECTED, ACTION, SCOPE, RISK, REGION, CVE, VECTOR, ACTORS, TIMELINE
    * Values should be short and impactful: numbers, regions, verbs. Max 8 words each.
    * Examples:
      - {"label": "WHY CARE", "value": "Databreach and compliance risk"}
      - {"label": "AFFECTED", "value": "75M customer records"}
      - {"label": "ACTION", "value": "Review vendor access controls"}
      - {"label": "SCOPE", "value": "Healthcare and finance sectors"}
      - {"label": "CVE", "value": "CVE-2026-1234 — CVSS 9.8"}
      - {"label": "REGION", "value": "Australia, APAC"}
      - {"label": "ACTORS", "value": "BlingLibra threat group"}
  - key_points: 2–3 concise bullets (backup detail, shown smaller).
  - source_article_id: MUST exactly match the chosen article's "id" from input.
  - display_seconds MUST be an integer from 8 to 15, based on content density:
    * 2 impact cards: 8–10 seconds
    * 3 impact cards: 10–13 seconds

Visual prompts (for each segment + intro + closing):
	- Always describe a DARK NOIR aesthetic scene consistent with a noir brand.
- Cinematic, atmospheric language; relevant to the story.
- Use specific security imagery (shields, locks, network diagrams, server racks, threat actors in shadows).
- Color palette: deep blues, blacks, amber accents.
- Explicitly include: "no text, no words, no letters".
- Each visual_prompt must be unique.

Quality:
- Keep everything SHORT and IMPACTFUL. Think TV news graphics, not paragraphs.
- Headlines and impact cards should be scannable in 2-3 seconds each.
"""


SYSTEM_PROMPT_EXECUTIVE = (
    SYSTEM_PROMPT_COMMON
    + """
Audience: Executive / CISO
- Lead with business impact: what this means for the organization.
- Avoid technical jargon; explain in plain language.
- Mention regulatory/compliance implications when relevant.
- Tone: authoritative, concise, board-ready.
- Keep each segment narration to 2–3 sentences.
"""
)


SYSTEM_PROMPT_SOC = (
    SYSTEM_PROMPT_COMMON
    + """
Audience: SOC / Threat Hunter
- Include actionable detection details inline when available (IOCs, infra hints, filenames, hashes, domains, IPs).
- Mention tactics/techniques and reference MITRE ATT&CK IDs when relevant.
- Include attribution/campaign context if the article provides it.
- Tone: tactical, peer-to-peer, immediately actionable.
"""
)


SYSTEM_PROMPT_ENGINEER = (
    SYSTEM_PROMPT_COMMON
    + """
Audience: Security Engineer
- Include CVE IDs, affected products/versions, and patch/mitigation status when available.
- Emphasize remediation steps, configuration guidance, and practical implementation details.
- Tone: technical, practical, hands-on.
"""
)


AUDIENCE_TO_SYSTEM_PROMPT: dict[str, str] = {
    "executive": SYSTEM_PROMPT_EXECUTIVE,
    "soc": SYSTEM_PROMPT_SOC,
    "engineer": SYSTEM_PROMPT_ENGINEER,
}


AUDIENCE_TO_TITLE: dict[str, str] = {
    "executive": "Executive",
    "soc": "SOC",
    "engineer": "Security Engineer",
}


@dataclass(frozen=True)
class Usage:
    input_tokens: int
    output_tokens: int


def eprint(*args: object) -> None:
    print(*args, file=sys.stderr)


def _load_json_from_stdin() -> Any:
    raw = sys.stdin.read()
    if not raw.strip():
        raise ValueError("No input received on stdin")
    return json.loads(raw)


def _load_json_from_file(path: str) -> Any:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def normalize_articles(payload: Any) -> list[dict[str, Any]]:
    """Accept either a list of articles or an object containing a list."""

    if isinstance(payload, list):
        rows = payload
    elif isinstance(payload, dict):
        if isinstance(payload.get("items"), list):
            rows = payload["items"]
        elif isinstance(payload.get("articles"), list):
            rows = payload["articles"]
        else:
            raise ValueError(
                "Expected a JSON list or an object with an 'items'/'articles' list"
            )
    else:
        raise ValueError("Expected JSON list/object for articles")

    out: list[dict[str, Any]] = []
    for r in rows:
        if not isinstance(r, dict):
            continue
        out.append(r)
    return out


def slim_article(a: dict[str, Any]) -> dict[str, Any]:
    """Reduce article fields to keep prompts smaller and stable."""

    def pick(obj: Any, *keys: str) -> Any:
        if not isinstance(obj, dict):
            return None
        cur: Any = obj
        for k in keys:
            if not isinstance(cur, dict):
                return None
            cur = cur.get(k)
        return cur

    return {
        "id": a.get("id"),
        "title": a.get("title"),
        "url": a.get("url"),
        "published_at": a.get("published_at"),
        "source": {
            "id": pick(a.get("source"), "id"),
            "name": pick(a.get("source"), "name"),
            "url": pick(a.get("source"), "url"),
        }
        if isinstance(a.get("source"), dict)
        else None,
        "category": {
            "id": pick(a.get("category"), "id"),
            "name": pick(a.get("category"), "name"),
            "slug": pick(a.get("category"), "slug"),
        }
        if isinstance(a.get("category"), dict)
        else None,
        "tags": a.get("tags"),
        "ioc_count": a.get("ioc_count"),
        "summary": a.get("summary"),
        "ai_summary": a.get("ai_summary"),
    }


def _fix_trailing_commas(text: str) -> str:
    """Remove trailing commas before } or ] — common LLM JSON error."""
    import re
    return re.sub(r",\s*([}\]])", r"\1", text)


def extract_json_object(text: str) -> dict[str, Any]:
    """Parse JSON from a model response, attempting to recover from minor wrapper text."""

    text = text.strip()

    def _try_parse(s: str) -> dict[str, Any] | None:
        for candidate in (s, _fix_trailing_commas(s)):
            try:
                val = json.loads(candidate)
                if isinstance(val, dict):
                    return val
            except json.JSONDecodeError:
                continue
        return None

    # Try full text first
    result = _try_parse(text)
    if result is not None:
        return result

    # Try to extract the first top-level {...} block
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        result = _try_parse(text[start : end + 1])
        if result is not None:
            return result

    raise ValueError("Could not extract valid JSON object from model response")


def clamp_int(v: Any, lo: int, hi: int, default: int) -> int:
    try:
        n = int(v)
    except Exception:
        return default
    return max(lo, min(hi, n))


def _require_str(v: Any, name: str) -> str:
    if not isinstance(v, str) or not v.strip():
        raise ValueError(f"Missing or invalid '{name}'")
    return v


def coerce_script_schema(
    *, raw: dict[str, Any], audience: str, date_str: str
) -> dict[str, Any]:
    """Drop extra keys, validate required keys, and compute estimated_duration_seconds."""

    intro_raw = raw.get("intro")
    closing_raw = raw.get("closing")
    segments_raw = raw.get("segments")
    if not isinstance(intro_raw, dict):
        raise ValueError("Output must include 'intro' as an object")
    if not isinstance(closing_raw, dict):
        raise ValueError("Output must include 'closing' as an object")
    if not isinstance(segments_raw, list) or not segments_raw:
        raise ValueError("Output must include non-empty 'segments' list")

    intro = {
        "text": _require_str(intro_raw.get("text"), "intro.text"),
        "visual_prompt": _require_str(
            intro_raw.get("visual_prompt"), "intro.visual_prompt"
        ),
    }
    closing = {
        "text": _require_str(closing_raw.get("text"), "closing.text"),
        "visual_prompt": _require_str(
            closing_raw.get("visual_prompt"), "closing.visual_prompt"
        ),
    }

    segments: list[dict[str, Any]] = []
    seg_seconds_sum = 0
    for idx, s in enumerate(segments_raw):
        if not isinstance(s, dict):
            continue

        key_points_raw = s.get("key_points")
        if not isinstance(key_points_raw, list) or not key_points_raw:
            raise ValueError(f"Segment {idx} must include non-empty key_points list")
        key_points: list[str] = []
        for kp in key_points_raw:
            if isinstance(kp, str) and kp.strip():
                key_points.append(kp.strip())
        if not key_points:
            raise ValueError(f"Segment {idx} must include string key_points")

        # Parse impact_cards
        impact_cards_raw = s.get("impact_cards")
        impact_cards: list[dict[str, str]] = []
        if isinstance(impact_cards_raw, list):
            for card in impact_cards_raw:
                if isinstance(card, dict) and card.get("label") and card.get("value"):
                    impact_cards.append({
                        "label": str(card["label"]).strip().upper(),
                        "value": str(card["value"]).strip(),
                    })

        cards_count = len(impact_cards)
        default_seconds = 10
        if cards_count <= 2:
            default_seconds = 9
        elif cards_count >= 3:
            default_seconds = 12

        display_seconds = clamp_int(s.get("display_seconds"), 8, 15, default_seconds)
        seg_seconds_sum += int(display_seconds)

        seg = {
            "headline": _require_str(s.get("headline"), f"segments[{idx}].headline"),
            "narration": _require_str(s.get("narration"), f"segments[{idx}].narration"),
            "impact_cards": impact_cards,
            "key_points": key_points,
            "visual_prompt": _require_str(
                s.get("visual_prompt"), f"segments[{idx}].visual_prompt"
            ),
            "source_article_id": _require_str(
                s.get("source_article_id"), f"segments[{idx}].source_article_id"
            ),
            "display_seconds": int(display_seconds),
        }
        segments.append(seg)

    estimated_duration_seconds = seg_seconds_sum + INTRO_SECONDS + CLOSING_SECONDS
    title_suffix = AUDIENCE_TO_TITLE.get(audience, audience)

    title = f"Daily Briefing — {title_suffix}"

    return {
        "audience": audience,
        "date": date_str,
        "title": title,
        "intro": intro,
        "segments": segments,
        "closing": closing,
        "estimated_duration_seconds": int(estimated_duration_seconds),
    }


def read_usage(resp: Any) -> Usage:
    usage = getattr(resp, "usage", None)
    input_tokens = int(getattr(usage, "input_tokens", 0) or 0)
    output_tokens = int(getattr(usage, "output_tokens", 0) or 0)
    return Usage(input_tokens=input_tokens, output_tokens=output_tokens)


def usage_to_cost_usd(u: Usage) -> float:
    in_cost = (u.input_tokens / 1_000_000.0) * HAIKU_INPUT_USD_PER_MTOK
    out_cost = (u.output_tokens / 1_000_000.0) * HAIKU_OUTPUT_USD_PER_MTOK
    return in_cost + out_cost


def generate_script(
    *, audience: str, date_str: str, articles: list[dict[str, Any]]
) -> tuple[dict[str, Any], Usage]:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is not set")

    try:
        import anthropic  # type: ignore
    except Exception as exc:
        raise RuntimeError(
            "Missing dependency 'anthropic'. Install from scripts/video/requirements.txt"
        ) from exc

    client = anthropic.Anthropic(api_key=api_key)

    sys_prompt = AUDIENCE_TO_SYSTEM_PROMPT[audience]

    prompt_articles = [slim_article(a) for a in articles]
    user_payload = {
        "date": date_str,
        "audience": audience,
        "instructions": {
            "use_ai_summary_preferentially": True,
            "output_schema": "Return a single JSON object matching the required schema.",
        },
        "articles": prompt_articles,
    }

    user_text = (
        "Generate today's video briefing script as JSON. "
        "Remember: output ONLY JSON, no markdown.\n\n"
        + json.dumps(user_payload, ensure_ascii=False)
    )

    started = time.time()
    resp = client.messages.create(
        model=MODEL,
        temperature=TEMPERATURE,
        max_tokens=4096,
        system=sys_prompt,
        messages=[{"role": "user", "content": user_text}],
    )
    duration_ms = int((time.time() - started) * 1000)
    log_ai_call(
        pipeline="video_script",
        model=MODEL,
        response=resp,
        duration_ms=duration_ms,
        metadata={
            "audience": audience,
            "date": date_str,
            "articles_in": len(articles),
        },
    )

    # Collect all text blocks.
    parts: list[str] = []
    for block in getattr(resp, "content", []) or []:
        t = getattr(block, "text", None)
        if isinstance(t, str):
            parts.append(t)
    text = "\n".join(parts).strip()
    stop_reason = getattr(resp, "stop_reason", None)
    if stop_reason == "end_turn":
        pass  # normal
    else:
        eprint(f"[generate_script] WARNING: stop_reason={stop_reason} (response may be truncated)")
        eprint(f"[generate_script] response tail: ...{text[-200:]}")
    script_obj = extract_json_object(text)
    script_obj = coerce_script_schema(
        raw=script_obj, audience=audience, date_str=date_str
    )

    return script_obj, read_usage(resp)



def parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Generate video briefing script JSON via Claude"
    )
    p.add_argument(
        "--audience",
        required=True,
        choices=sorted(AUDIENCE_TO_SYSTEM_PROMPT.keys()),
        help="Target audience: executive, soc, or engineer",
    )
    p.add_argument(
        "--articles",
        help="Path to articles JSON file. If omitted, reads JSON from stdin.",
    )
    p.add_argument(
        "--date",
        required=True,
        help="Briefing date (YYYY-MM-DD)",
    )
    return p.parse_args(argv)


def validate_date(date_str: str) -> str:
    try:
        date_type.fromisoformat(date_str)
    except Exception as exc:
        raise ValueError("--date must be in YYYY-MM-DD format") from exc
    return date_str


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    audience = str(args.audience)
    date_str = validate_date(str(args.date))

    payload = (
        _load_json_from_file(args.articles)
        if args.articles
        else _load_json_from_stdin()
    )
    articles = normalize_articles(payload)

    eprint(
        f"[generate_script] audience={audience} date={date_str} articles_in={len(articles)} model={MODEL}"
    )

    script, u = generate_script(audience=audience, date_str=date_str, articles=articles)
    cost_usd = usage_to_cost_usd(u)
    eprint(f"[generate_script] tokens input={u.input_tokens} output={u.output_tokens}")
    eprint(
        f"[generate_script] estimated cost=${cost_usd:.6f} (haiku in ${HAIKU_INPUT_USD_PER_MTOK}/MTok, out ${HAIKU_OUTPUT_USD_PER_MTOK}/MTok)"
    )

    json.dump(script, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main(sys.argv[1:]))
    except BrokenPipeError:
        # Allow piping to `head` etc.
        raise
    except Exception as exc:
        eprint(f"[generate_script] ERROR: {exc}")
        raise SystemExit(1)
