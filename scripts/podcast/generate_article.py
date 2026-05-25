#!/usr/bin/env python3
"""ThreatNoir Podcast — generate accompanying written article (LEN-1098).

Uses Claude Haiku via the Anthropic SDK to turn the same set of input articles
into a clean, non-dialogue markdown report.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from datetime import date as date_type
from typing import Any

from generate_dialogue import (  # type: ignore
    Usage,
    normalize_articles,
    read_usage,
    slim_article,
    usage_to_cost_usd,
)

# Ensure repo root is on sys.path so we can import scripts/utils when executed
# directly (e.g. `python scripts/podcast/generate_article.py`).
_d = os.path.abspath(os.path.dirname(__file__))
while os.path.basename(_d) != "scripts" and _d != os.path.dirname(_d):
    _d = os.path.dirname(_d)
_project_root = os.path.dirname(_d)
if _project_root and _project_root not in sys.path:
    sys.path.insert(0, _project_root)

from scripts.utils.ai_cost import log_ai_call  # noqa: E402


MODEL = "claude-haiku-4-5-20251001"


SYSTEM_PROMPT = """You are ThreatNoir's IT security journalist.

Write a professional written report in markdown format.

Hard rules:
- Output markdown ONLY. No XML. No code fences. No preambles.
- This is an article/report. NOT dialogue. Do not include speaker names.
- Do NOT use bullet points or numbered lists.
- Each news story MUST be a section with a heading.
- Each story section MUST include an inline markdown link to its source URL in the form: [Source Title](url)
- Use ONLY facts present in the provided article fields.

Structure:
1) Title as a single H1 heading
2) One brief intro paragraph setting the day's context
3) One section per story (heading + 1–3 paragraphs)
4) One brief closing paragraph
"""


def _pretty_full_date(date_str: str) -> str:
    d = date_type.fromisoformat(date_str)
    # Avoid %-d portability issues.
    return f"{d.strftime('%B')} {d.day}, {d.year}"


def _edition_title(*, date_str: str, edition: str) -> str:
    full_date = _pretty_full_date(date_str)
    label = "Morning" if edition == "morning" else "Afternoon"
    return f"{label} Review in IT Security — {full_date}"


def _force_h1_title(md: str, *, title: str) -> str:
    text = md.lstrip("\ufeff\n\r\t ")
    if not text:
        return f"# {title}\n"

    if text.startswith("# "):
        # Replace the first H1 line to guarantee exact title.
        return re.sub(r"(?m)^# .*$", f"# {title}", text, count=1)

    return f"# {title}\n\n{text}"


def _ensure_story_sections(md: str, *, articles: list[dict[str, Any]]) -> str:
    """Ensure every article has a section heading and an inline source link.

    The model may paraphrase section headings, causing exact heading matching
    to think an article is missing and append a duplicate stub section.

    To avoid that, when an exact "## {title}" heading is not found, we fall back
    to fuzzy matching: extract significant words (4+ chars) from the article
    title, and consider the article "covered" if at least 50% of those words
    appear anywhere in the markdown (case-insensitive).
    """

    out = md
    for a in articles:
        title = str(a.get("title") or "").strip() or "Untitled"
        url = str(a.get("url") or "").strip()
        summary = str(a.get("summary") or "").strip()
        if not url:
            continue

        heading = f"## {title}"
        h_idx = out.find(heading)
        if h_idx == -1:
            lower_md = out.lower()
            words = re.findall(r"[a-z0-9]{4,}", title.lower())
            words = list(dict.fromkeys(words))
            if words:
                matches = sum(1 for w in words if w in lower_md)
                if (matches / len(words)) >= 0.5:
                    continue  # Article is already covered (paraphrased heading).

            # Append a minimal compliant section.
            out = (
                out.rstrip()
                + "\n\n"
                + heading
                + "\n"
                + f"Source: [{title}]({url})\n\n"
                + (summary + "\n" if summary else "")
            )
            continue

        # If the section exists, ensure its URL appears before the next section.
        section_start = out.find("\n", h_idx)
        if section_start == -1:
            section_start = h_idx + len(heading)
        next_h = out.find("\n## ", section_start)
        section_end = len(out) if next_h == -1 else next_h
        section_text = out[h_idx:section_end]
        if url not in section_text:
            insert_at = section_start + 1
            out = out[:insert_at] + f"Source: [{title}]({url})\n\n" + out[insert_at:]

    return out


def generate_article(
    articles: list[dict[str, Any]],
    date_str: str,
    edition: str = "morning",
) -> tuple[str, Usage]:
    """Generate a written article from the same articles used for the podcast.

    Returns (article_markdown: str, usage: Usage)
    """

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is not set")

    try:
        import anthropic  # type: ignore
    except Exception as exc:
        raise RuntimeError(
            "Missing dependency 'anthropic'. Install from scripts/podcast/requirements.txt"
        ) from exc

    edition = (edition or "morning").strip().lower()
    if edition not in {"morning", "afternoon"}:
        edition = "morning"

    title = _edition_title(date_str=date_str, edition=edition)
    prompt_articles = [slim_article(a) for a in articles]

    user_payload = {
        "date": date_str,
        "edition": edition,
        "title": title,
        "articles": prompt_articles,
        "requirements": {
            "format": "markdown",
            "no_dialogue": True,
            "no_bullets": True,
            "must_link_each_story": True,
            "source_link_format": "[Source Title](url)",
        },
    }

    user_text = (
        "Write the accompanying ThreatNoir podcast article/report as markdown. "
        "Use the provided title exactly as the H1 heading. "
        "Cover ALL provided stories. "
        "For each story section, include a sentence containing: "
        "Source: [<Source Title>](<url>) using the exact title/url from input.\n\n"
        f"Title: {title}\n\n"
        "Input articles (use only these facts):\n"
        + json.dumps(user_payload, ensure_ascii=False)
    )

    client = anthropic.Anthropic(api_key=api_key)
    started = time.time()
    resp = client.messages.create(
        model=MODEL,
        temperature=0.6,
        max_tokens=3500,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_text}],
    )
    duration_ms = int((time.time() - started) * 1000)
    log_ai_call(
        pipeline="podcast_article",
        model=MODEL,
        response=resp,
        duration_ms=duration_ms,
        metadata={
            "date": date_str,
            "edition": edition,
            "articles_in": len(articles),
        },
    )

    parts: list[str] = []
    for block in getattr(resp, "content", []) or []:
        t = getattr(block, "text", None)
        if isinstance(t, str):
            parts.append(t)
    md = "\n".join(parts).strip()

    md = _force_h1_title(md, title=title)
    md = _ensure_story_sections(md, articles=prompt_articles)
    return md.strip() + "\n", read_usage(resp)


def _load_json_from_file(path: str) -> Any:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _validate_date(date_str: str) -> str:
    try:
        date_type.fromisoformat(date_str)
    except Exception as exc:
        raise ValueError("--date must be in YYYY-MM-DD format") from exc
    return date_str


def parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Generate ThreatNoir podcast accompanying article via Claude"
    )
    p.add_argument("--articles", required=True, help="Path to articles JSON file")
    p.add_argument("--date", required=True, help="Podcast date (YYYY-MM-DD)")
    p.add_argument(
        "--edition",
        choices=["morning", "afternoon"],
        default="morning",
        help="Edition: morning (default) or afternoon",
    )
    p.add_argument(
        "--output",
        help="Optional output path. If omitted, writes markdown to stdout.",
    )
    return p.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    date_str = _validate_date(str(args.date))
    payload = _load_json_from_file(str(args.articles))
    articles = normalize_articles(payload)

    md, usage = generate_article(
        articles=articles,
        date_str=date_str,
        edition=str(args.edition),
    )
    cost_usd = usage_to_cost_usd(usage)
    print(
        f"[generate_article] tokens input={usage.input_tokens} output={usage.output_tokens} est_cost=${cost_usd:.6f}",
        file=sys.stderr,
    )

    if args.output:
        with open(str(args.output), "w", encoding="utf-8") as f:
            f.write(md)
        print(f"[generate_article] wrote {args.output}", file=sys.stderr)
    else:
        sys.stdout.write(md)
    return 0


if __name__ == "__main__":  # pragma: no cover
    try:
        raise SystemExit(main(sys.argv[1:]))
    except BrokenPipeError:
        raise
    except Exception as exc:
        print(f"[generate_article] ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
