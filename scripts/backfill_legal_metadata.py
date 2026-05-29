#!/usr/bin/env python3
"""LEN-1132: Backfill legal/regulatory metadata on existing articles.

This script:
- Queries approved articles missing jurisdiction/regulation.
- Filters for likely regulatory content via category/tag slugs and keyword regex.
- Calls Claude Haiku to extract {jurisdiction, regulation, fine_amount}.
- Updates rows via Supabase Management API (database/query).

Idempotent: only updates rows where jurisdiction/regulation are still NULL.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from dataclasses import dataclass
from typing import Any

# Ensure repo root is on sys.path so we can import scripts/utils when executed
# directly (e.g. `python scripts/backfill_legal_metadata.py`).
_d = os.path.abspath(os.path.dirname(__file__))
while os.path.basename(_d) != "scripts" and _d != os.path.dirname(_d):
    _d = os.path.dirname(_d)
_project_root = os.path.dirname(_d)
if _project_root and _project_root not in sys.path:
    sys.path.insert(0, _project_root)

from scripts.utils.ai_cost import log_ai_call  # noqa: E402


SUPABASE_REF = os.environ.get("SUPABASE_PROJECT_REF")
if not SUPABASE_REF:
    raise RuntimeError("SUPABASE_PROJECT_REF env var required")
SUPABASE_QUERY_URL = (
    f"https://api.supabase.com/v1/projects/{SUPABASE_REF}/database/query"
)

MODEL = "claude-haiku-4-5-20251001"
TEMPERATURE = 0.2


LEGAL_SLUGS = (
    "compliance",
    "privacy",
    "policy",
    "gdpr",
    "ccpa-cpra",
    "hipaa",
    "nis2",
    "pci-dss",
    "dora",
    "privacy-fines",
    "uk-data-protection",
    "eu-ai-act",
    "eu-cyber-resilience-act",
    "eu-cybersecurity-act",
    "dsa-dma",
    "nist",
    "sec-cyber",
)

TITLE_REGEX = r"(GDPR|CCPA|HIPAA|NIS2|DORA|PCI[\\.-]?DSS|fine|penalt|regulat|compliance|enforcement|DPA|privacy act|AI Act|Cyber Resilience)"
SUMMARY_REGEX = r"(GDPR|CCPA|HIPAA|NIS2|DORA|fine|penalt|regulat|enforcement|DPA|privacy act|AI Act|Cyber Resilience)"


@dataclass
class BackfillStats:
    processed: int = 0
    updated: int = 0
    skipped: int = 0
    errored: int = 0


def eprint(*args: object) -> None:
    print(*args, file=sys.stderr)


def get_supabase_pat() -> str:
    env = os.environ.get("SUPABASE_PAT")
    if env:
        return env.strip()
    return subprocess.check_output(
        ["op", "read", "op://Claude/Supabase/PAT"],
        text=True,
    ).strip()


def get_anthropic_key() -> str:
    env = os.environ.get("ANTHROPIC_API_KEY")
    if env:
        return env.strip()
    return subprocess.check_output(
        ["op", "read", "op://Claude/Anthropic/api_key"],
        text=True,
    ).strip()


def _sql_literal(value: str | None) -> str:
    """Return a safe SQL literal for the Supabase Management API.

    - None => NULL
    - str => single-quoted with internal quotes doubled
    """

    if value is None:
        return "NULL"
    v = str(value)
    v = v.replace("\x00", "")
    return "'" + v.replace("'", "''") + "'"


def _require_httpx() -> Any:
    try:
        import httpx  # type: ignore

        return httpx
    except Exception as exc:  # pragma: no cover
        raise RuntimeError("Missing dependency 'httpx'") from exc


def run_query(pat: str, query: str) -> Any:
    httpx = _require_httpx()
    resp = httpx.post(
        SUPABASE_QUERY_URL,
        headers={
            "Authorization": f"Bearer {pat}",
            "Content-Type": "application/json",
        },
        json={"query": query},
        timeout=30.0,
    )
    resp.raise_for_status()
    return resp.json()


def _extract_query_rows(payload: Any) -> list[dict[str, Any]]:
    """Best-effort extraction of row list from Supabase Management API response."""
    if isinstance(payload, list):
        return [r for r in payload if isinstance(r, dict)]
    if not isinstance(payload, dict):
        return []
    for key in ("result", "rows", "data"):
        val = payload.get(key)
        if isinstance(val, list):
            return [r for r in val if isinstance(r, dict)]
    return []


def _fix_trailing_commas(text: str) -> str:
    """Remove trailing commas before } or ] — common LLM JSON error."""
    import re

    return re.sub(r",\s*([}\]])", r"\1", text)


def extract_json_object(text: str) -> dict[str, Any]:
    """Parse a JSON object from model response text."""
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

    result = _try_parse(text)
    if result is not None:
        return result

    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        result = _try_parse(text[start : end + 1])
        if result is not None:
            return result
    raise ValueError("Could not extract valid JSON object from model response")


def _opt_str(v: Any) -> str | None:
    if v is None:
        return None
    if isinstance(v, str):
        s = v.strip()
        return s or None
    # Allow simple non-string scalars.
    if isinstance(v, (int, float)):
        s = str(v).strip()
        return s or None
    return None


def fetch_candidate_articles(
    pat: str, *, limit: int | None = None
) -> list[dict[str, Any]]:
    slugs_csv = ",".join(_sql_literal(s) for s in LEGAL_SLUGS)
    limit_sql = f"\nLIMIT {int(limit)}" if isinstance(limit, int) and limit > 0 else ""

    query = f"""
SELECT a.id, a.title, COALESCE(a.ai_summary, a.summary) as summary
FROM articles a
LEFT JOIN categories c ON a.category_id = c.id
WHERE a.status = 'approved'
  AND a.jurisdiction IS NULL
  AND a.regulation IS NULL
  AND (
    c.slug IN ({slugs_csv})
    OR EXISTS (
      SELECT 1
      FROM article_tags at
      JOIN categories tc ON at.category_id = tc.id
      WHERE at.article_id = a.id
        AND tc.slug IN ({slugs_csv})
    )
    OR a.title ~* {_sql_literal(TITLE_REGEX)}
    OR COALESCE(a.ai_summary, a.summary, '') ~* {_sql_literal(SUMMARY_REGEX)}
  )
ORDER BY a.published_at DESC
{limit_sql}
""".strip()

    payload = run_query(pat, query)
    rows = _extract_query_rows(payload)
    out: list[dict[str, Any]] = []
    for r in rows:
        if not r.get("id") or not r.get("title"):
            continue
        out.append(
            {
                "id": str(r.get("id")),
                "title": str(r.get("title")),
                "summary": str(r.get("summary") or ""),
            }
        )
    return out


SYSTEM_PROMPT = (
    "You are a careful information extraction system. "
    "Return ONLY JSON. No markdown. No commentary."
)


def extract_legal_metadata(
    *, client: Any, title: str, summary: str, article_id: str | None = None
) -> tuple[str | None, str | None, str | None]:
    user_text = (
        "Given this security article, extract regulatory metadata. "
        "Return JSON only with exactly these keys: "
        "{jurisdiction, regulation, fine_amount}. "
        "Rules: jurisdiction = country or region if regulatory (e.g. EU, France, US, UK). "
        "regulation = canonical short name (e.g. GDPR, NIS2, CCPA, HIPAA, DORA, PCI-DSS, SEC cyber rules). "
        "fine_amount = penalty amount if enforcement action (e.g. €1.2M, $500K). "
        "Use null for fields that do not apply.\n\n"
        f"Title: {title}\n\n"
        f"Summary: {summary}\n"
    )

    started = time.time()
    resp = client.messages.create(
        model=MODEL,
        temperature=TEMPERATURE,
        max_tokens=200,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_text}],
    )
    duration_ms = int((time.time() - started) * 1000)
    log_ai_call(
        pipeline="legal_metadata_backfill",
        model=MODEL,
        response=resp,
        duration_ms=duration_ms,
        metadata={
            "article_id": article_id,
        },
    )

    parts: list[str] = []
    for block in getattr(resp, "content", []) or []:
        t = getattr(block, "text", None)
        if isinstance(t, str):
            parts.append(t)
    text = "\n".join(parts).strip()

    obj = extract_json_object(text)
    jurisdiction = _opt_str(obj.get("jurisdiction"))
    regulation = _opt_str(obj.get("regulation"))
    fine_amount = _opt_str(obj.get("fine_amount"))
    return jurisdiction, regulation, fine_amount


def update_article(
    pat: str,
    *,
    article_id: str,
    jurisdiction: str | None,
    regulation: str | None,
    fine_amount: str | None,
) -> None:
    query = (
        "UPDATE articles SET "
        f"jurisdiction = {_sql_literal(jurisdiction)}, "
        f"regulation = {_sql_literal(regulation)}, "
        f"fine_amount = {_sql_literal(fine_amount)} "
        f"WHERE id = {_sql_literal(article_id)} "
        "AND jurisdiction IS NULL AND regulation IS NULL"
    )
    run_query(pat, query)


def parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Backfill legal metadata for existing articles"
    )
    p.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Optional max number of candidate articles to process",
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="Do not write updates to the database",
    )
    p.add_argument(
        "--sleep",
        type=float,
        default=0.5,
        help="Seconds to sleep between LLM requests (default: 0.5)",
    )
    return p.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)

    pat = get_supabase_pat()
    api_key = get_anthropic_key()

    try:
        import anthropic  # type: ignore
    except Exception as exc:  # pragma: no cover
        raise RuntimeError(
            "Missing dependency 'anthropic'. Install it in the Python environment used to run scripts."
        ) from exc

    client = anthropic.Anthropic(api_key=api_key)

    articles = fetch_candidate_articles(pat, limit=args.limit)
    total = len(articles)
    eprint(f"[backfill] candidates={total} model={MODEL} dry_run={bool(args.dry_run)}")

    stats = BackfillStats()
    for i, a in enumerate(articles, start=1):
        stats.processed += 1
        title = str(a.get("title") or "").strip()
        summary = str(a.get("summary") or "").strip()
        article_id = str(a.get("id") or "").strip()
        if not title or not article_id:
            stats.skipped += 1
            continue

        try:
            jurisdiction, regulation, fine_amount = extract_legal_metadata(
                client=client, title=title, summary=summary, article_id=article_id
            )
        except Exception as exc:
            stats.errored += 1
            eprint(f"[backfill] {i}/{total} — {title!r} → ERROR: {exc}")
            time.sleep(max(float(args.sleep), 0.0))
            continue

        # If model says it's not regulatory at all, treat as skip.
        if jurisdiction is None and regulation is None and fine_amount is None:
            stats.skipped += 1
            eprint(
                f"[backfill] {i}/{total} — {title!r} → jurisdiction=None, regulation=None, fine=None (skipped)"
            )
            time.sleep(max(float(args.sleep), 0.0))
            continue

        if not args.dry_run:
            try:
                update_article(
                    pat,
                    article_id=article_id,
                    jurisdiction=jurisdiction,
                    regulation=regulation,
                    fine_amount=fine_amount,
                )
            except Exception as exc:
                stats.errored += 1
                eprint(f"[backfill] {i}/{total} — {title!r} → UPDATE ERROR: {exc}")
                time.sleep(max(float(args.sleep), 0.0))
                continue

        stats.updated += 1
        eprint(
            "[backfill] "
            f"{i}/{total} — {title!r} → "
            f"jurisdiction={jurisdiction}, regulation={regulation}, fine={fine_amount}"
        )

        time.sleep(max(float(args.sleep), 0.0))

    eprint(
        f"[backfill] complete. processed={stats.processed}, updated={stats.updated}, skipped={stats.skipped}, errored={stats.errored}"
    )
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main(sys.argv[1:]))
