#!/usr/bin/env python3
"""ThreatNoir Podcast — end-to-end orchestrator (LEN-1080, LEN-1084).

Chains: fetch articles → dialogue → TTS → mix → upload to R2 → upsert DB → Discord DM.

Supports morning and afternoon editions. Afternoon edition excludes articles
already covered in the morning episode.

Usage:
    python scripts/podcast/generate.py
    python scripts/podcast/generate.py --edition afternoon
    python scripts/podcast/generate.py --date 2026-03-15 --edition morning
    python scripts/podcast/generate.py --dry-run
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
import time
import traceback
import uuid
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo


# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

SUPABASE_REF = (os.environ.get("SUPABASE_URL") or "").replace("https://", "").replace("http://", "").split(".")[0]
if not SUPABASE_REF:
    raise SystemExit("SUPABASE_URL env var required (e.g. https://abcdefgh.supabase.co)")
DEFAULT_SUPABASE_URL = f"https://{SUPABASE_REF}.supabase.co"

R2_PUBLIC_BASE = "https://cdn.threatnoir.com"
R2_BUCKET = "threatnoir-videos"

# Dialogue generation retry policy: Claude/LLM output can rarely be malformed or
# transiently unavailable (timeouts, 5xx, rate limits). We want the cron to be
# resilient without hiding permanent failures.
MAX_DIALOGUE_RETRIES = 5
DIALOGUE_RETRY_BACKOFF_SECONDS = 300  # 5 minutes


def _should_retry_dialogue(exc: Exception) -> bool:
    """Retry on transient LLM/network errors. Not on permanent errors."""

    msg = str(exc).lower()
    permanent_markers = (
        "api key",
        "unauthorized",
        "401",
        "forbidden",
        "403",
        "content policy",
        "safety",
        "refused",
        "invalid model",
        "model not found",
        "not found",
    )
    if any(marker in msg for marker in permanent_markers):
        return False

    # Retry JSON parse errors, timeouts, rate limits, 5xx, connection issues, empty responses
    return True


@dataclass
class RunResult:
    date_str: str
    article_count: int
    duration_seconds: int | None
    audio_url: str | None
    cost_usd: float
    total_characters: int


def eprint(*args: object) -> None:
    print(*args, file=sys.stderr)


@dataclass(frozen=True)
class _CoveredTopic:
    """A story previously covered in a recent podcast episode."""

    title: str
    summary: str
    episode_date: date
    episode_edition: str


STOCKHOLM_TZ = ZoneInfo("Europe/Stockholm")


def _today_in_stockholm(now_utc: datetime | None = None) -> date:
    """Return today's date in Sweden (Europe/Stockholm).

    Accepts an optional UTC datetime for deterministic testing.
    """

    if now_utc is None:
        now_utc = datetime.now(timezone.utc)
    if now_utc.tzinfo is None:
        raise ValueError("now_utc must be timezone-aware")
    return now_utc.astimezone(STOCKHOLM_TZ).date()


def _parse_podcast_date(value: str | None) -> date:
    """Podcast date (defaults to today in Sweden / Europe/Stockholm)."""
    if value in (None, "", "today"):
        return _today_in_stockholm()
    return date.fromisoformat(value)


EDITION_LABELS = {"morning": "Morning Brief", "afternoon": "Afternoon Brief"}


def _get_edition_window(podcast_date: date, edition: str) -> tuple[str, str]:
    """Return (start_ts, end_ts) in UTC ISO format for the edition's time window.

    Morning: previous day 16:00 Europe/Stockholm → podcast day 07:00 Europe/Stockholm
    Afternoon: podcast day 07:00 Europe/Stockholm → podcast day 16:00 Europe/Stockholm
    """
    if edition == "afternoon":
        start_local = datetime(
            podcast_date.year,
            podcast_date.month,
            podcast_date.day,
            7,
            tzinfo=STOCKHOLM_TZ,
        )
        end_local = datetime(
            podcast_date.year,
            podcast_date.month,
            podcast_date.day,
            16,
            tzinfo=STOCKHOLM_TZ,
        )
    else:
        prev = podcast_date - timedelta(days=1)
        start_local = datetime(prev.year, prev.month, prev.day, 16, tzinfo=STOCKHOLM_TZ)
        end_local = datetime(
            podcast_date.year,
            podcast_date.month,
            podcast_date.day,
            7,
            tzinfo=STOCKHOLM_TZ,
        )

    start_utc = start_local.astimezone(timezone.utc)
    end_utc = end_local.astimezone(timezone.utc)
    return start_utc.strftime("%Y-%m-%dT%H:%M:%S"), end_utc.strftime(
        "%Y-%m-%dT%H:%M:%S"
    )


# ---------------------------------------------------------------------------
# Step 1: Fetch articles (reuses scripts/video/fetch_articles.py)
# ---------------------------------------------------------------------------


def _word_set(text: str) -> set[str]:
    """Extract a stable word set for Jaccard similarity.

    No external deps; keep it simple and deterministic.
    """

    import re as _re

    stop = {
        "a",
        "about",
        "after",
        "an",
        "and",
        "are",
        "as",
        "at",
        "be",
        "been",
        "but",
        "by",
        "can",
        "could",
        "for",
        "from",
        "has",
        "have",
        "how",
        "in",
        "into",
        "is",
        "it",
        "its",
        "new",
        "of",
        "on",
        "or",
        "over",
        "says",
        "that",
        "the",
        "their",
        "this",
        "to",
        "was",
        "were",
        "will",
        "with",
    }
    words = _re.findall(r"[a-z0-9]+", (text or "").lower())
    return {w for w in words if w not in stop and len(w) > 2}


def _jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    union = a | b
    if not union:
        return 0.0
    return len(a & b) / len(union)


def _extract_cves(text: str) -> set[str]:
    """Extract CVE IDs from free text."""
    import re as _re

    # CVE-YYYY-NNNN... (4-7 digits is common; allow longer to be safe)
    found = _re.findall(
        r"\bCVE-[0-9]{4}-[0-9]{4,8}\b", text or "", flags=_re.IGNORECASE
    )
    return {c.upper() for c in found}


def _extract_security_keywords(text: str) -> set[str]:
    """Extract a small set of security keywords to help dedup semantically."""
    import re as _re

    keywords = {
        "backdoor",
        "botnet",
        "breach",
        "campaign",
        "credential",
        "cve",
        "ddos",
        "exploit",
        "intrusion",
        "leak",
        "malware",
        "phishing",
        "ransomware",
        "rce",
        "rootkit",
        "supply",
        "trojan",
        "vulnerability",
        "vulnerabilities",
        "zero",
        "zeroday",
        "zero-day",
    }

    words = _re.findall(r"[a-z0-9\-]+", (text or "").lower())
    # Normalize zero-day variants
    out: set[str] = set()
    for w in words:
        if w in keywords:
            out.add("zero-day" if w in {"zero", "zeroday", "zero-day"} else w)
    # Add common compound keyword detection
    if "zero" in words and "day" in words:
        out.add("zero-day")
    return out


def _extract_entities(text: str) -> set[str]:
    """Heuristic entity extraction (proper nouns, acronyms).

    Goal: cheaply detect shared key nouns like orgs/products/threat actors.
    """
    import re as _re

    if not text:
        return set()

    entity_stop = {
        "the",
        "a",
        "an",
        "and",
        "or",
        "of",
        "to",
        "in",
        "on",
        "for",
        "with",
        "from",
        "as",
        "by",
        "at",
        "is",
        "are",
        "was",
        "were",
        "this",
        "that",
        "these",
        "those",
        "today",
        "yesterday",
        "report",
        "reports",
        "reported",
        "researcher",
        "researchers",
        "update",
        "updates",
        "breaking",
        "security",
    }

    # Multi-word capitalized entities (up to 3 words)
    caps = _re.findall(r"\b[A-Z][a-z0-9]{2,}(?:\s+[A-Z][a-z0-9]{2,}){0,2}\b", text)
    # Acronyms / all-caps (allow digits/hyphens, require at least one letter)
    acronyms = _re.findall(
        r"\b(?=[A-Z0-9\-]{2,}\b)(?=.*[A-Z])[A-Z0-9]+(?:-[A-Z0-9]+)*\b", text
    )

    raw = set(caps) | set(acronyms)
    out: set[str] = set()
    for ent in raw:
        e = ent.strip().strip(".,:;()[]{}\"'")
        if not e:
            continue
        e_norm = " ".join(e.split()).lower()
        if e_norm in entity_stop:
            continue
        # Avoid generic single words that are rarely useful
        if " " not in e_norm and len(e_norm) < 4:
            continue
        out.add(e_norm)

    return out


def _title_words(title: str) -> set[str]:
    """Extract meaningful words from a title for similarity comparison."""
    return _word_set(title)


def _titles_similar(a: str, b: str, threshold: float = 0.45) -> bool:
    """Check if two article titles cover the same story using Jaccard similarity."""
    return _jaccard(_title_words(a), _title_words(b)) >= threshold


def _episode_when_phrase(
    *,
    current_date: date,
    current_edition: str,
    covered_date: date,
    covered_edition: str,
) -> str:
    """Return a natural relative time phrase for a previously covered episode.

    Examples: "this morning", "yesterday afternoon", "two days ago morning".
    Avoids day names to respect prompt constraints.
    """

    current_edition = (current_edition or "morning").strip().lower()
    covered_edition = (covered_edition or "morning").strip().lower()

    if covered_date == current_date:
        # Most relevant case: afternoon referencing the morning edition.
        if covered_edition == "morning" and current_edition == "afternoon":
            return "this morning"
        return "earlier today"

    delta_days = (current_date - covered_date).days
    if delta_days <= 0:
        base = "earlier"
    elif delta_days == 1:
        base = "yesterday"
    elif delta_days == 2:
        base = "two days ago"
    else:
        base = "three days ago"

    if covered_edition in {"morning", "afternoon"}:
        return f"{base} {covered_edition}"
    return base


def _topic_overlap_reason(
    *, today: dict[str, Any], covered: _CoveredTopic
) -> str | None:
    """Return a match reason if topic overlap is detected."""

    today_title = str(today.get("title") or "")
    today_summary = str(today.get("summary") or "")
    today_text = f"{today_title}\n{today_summary}".strip()

    covered_title = covered.title
    covered_summary = covered.summary
    covered_text = f"{covered_title}\n{covered_summary}".strip()

    if not today_text or not covered_text:
        return None

    # 1) Exact CVE match
    cves_today = _extract_cves(today_text)
    cves_covered = _extract_cves(covered_text)
    if cves_today and cves_covered and (cves_today & cves_covered):
        return "cve"

    # 2) Title similarity (ticket asks for Jaccard > 0.4)
    if _jaccard(_title_words(today_title), _title_words(covered_title)) > 0.4:
        return "title"

    # 3) Org/product overlap (simple entity intersection)
    ents_today = _extract_entities(today_text)
    ents_covered = _extract_entities(covered_text)
    if ents_today and ents_covered and (ents_today & ents_covered):
        return "entity"

    return None


def _build_previously_covered_lines(
    *,
    today_articles: list[dict[str, Any]],
    covered_topics: list[_CoveredTopic],
    current_date: date,
    current_edition: str,
    max_items: int = 6,
) -> list[str]:
    """Build compact 'previously covered' lines for the dialogue prompt."""

    if not today_articles or not covered_topics:
        return []

    matched: dict[tuple[str, date, str], str] = {}

    # Iterate today's articles and find any overlap against recently covered stories.
    for a in today_articles:
        best: tuple[int, _CoveredTopic, str] | None = None

        for ct in covered_topics:
            reason = _topic_overlap_reason(today=a, covered=ct)
            if not reason:
                continue

            # Prefer most confident signals.
            score = {"cve": 3, "title": 2, "entity": 1}.get(reason, 0)
            if best is None or score > best[0]:
                best = (score, ct, reason)
            if score >= 3:
                break  # can't beat CVE match

        if not best:
            continue

        _, ct, _reason = best
        key = (ct.title, ct.episode_date, ct.episode_edition)
        when = _episode_when_phrase(
            current_date=current_date,
            current_edition=current_edition,
            covered_date=ct.episode_date,
            covered_edition=ct.episode_edition,
        )
        matched[key] = f'"{ct.title}" — covered {when}'

    # Most recent first.
    lines = sorted(
        matched.items(),
        key=lambda kv: (kv[0][1].toordinal(), kv[0][2]),
        reverse=True,
    )
    return [line for _, line in lines[:max_items]]


def _fetch_recent_intros(
    podcast_date: date,
    limit: int = 5,
) -> list[str]:
    """Fetch opening lines from recent episodes to prevent intro repetition."""

    import httpx

    base_url = os.environ.get("SUPABASE_URL", DEFAULT_SUPABASE_URL).rstrip("/")
    service_key = os.environ.get("SUPABASE_SERVICE_KEY", "")
    if not service_key:
        return []

    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
    }

    # Fetch last N episodes with dialogue
    params = {
        "select": "dialogue",
        "order": "date.desc,edition.desc",
        "limit": str(limit),
        "date": f"lt.{podcast_date.isoformat()}",
        "dialogue": "not.is.null",
    }

    try:
        resp = httpx.get(
            f"{base_url}/rest/v1/podcast_episodes",
            params=params,
            headers=headers,
            timeout=15,
        )
        resp.raise_for_status()
        rows = resp.json()
    except Exception as exc:
        eprint(f"[podcast] failed to fetch recent intros: {exc}")
        return []

    intros: list[str] = []
    for row in rows:
        dialogue = row.get("dialogue")
        if not isinstance(dialogue, dict):
            continue
        intro_lines = dialogue.get("intro") or []
        if intro_lines and isinstance(intro_lines, list):
            first = intro_lines[0]
            if isinstance(first, dict):
                text = str(first.get("text") or "").strip()
                if text:
                    intros.append(text)
    return intros


def _fetch_recent_covered_topics(
    *,
    podcast_date: date,
    edition: str,
    lookback_days: int = 3,
) -> list[_CoveredTopic]:
    """Fetch covered topics from recent episodes (last N days) from Supabase.

    Returns an empty list on missing credentials or errors (graceful fallback).
    """

    import httpx

    base_url = os.environ.get("SUPABASE_URL", DEFAULT_SUPABASE_URL).rstrip("/")
    service_key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not service_key:
        return []

    start_date = podcast_date - timedelta(days=int(lookback_days))
    end_date = podcast_date

    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Accept": "application/json",
    }

    try:
        resp = httpx.get(
            f"{base_url}/rest/v1/podcast_episodes",
            params=[
                ("select", "date,edition,article_ids,created_at"),
                ("date", f"gte.{start_date.isoformat()}"),
                ("date", f"lte.{end_date.isoformat()}"),
                ("order", "date.desc,created_at.desc"),
            ],
            headers=headers,
            timeout=20.0,
        )
        if not resp.is_success:
            return []
        episodes = resp.json()
        if not isinstance(episodes, list) or not episodes:
            return []
    except Exception as exc:
        eprint(f"[podcast] warning: failed to fetch recent podcast episodes: {exc}")
        return []

    # Exclude the episode we are currently generating.
    cur_edition = (edition or "morning").strip().lower()
    recent_rows: list[dict[str, Any]] = []
    for row in episodes:
        if not isinstance(row, dict):
            continue
        if (
            str(row.get("date") or "") == podcast_date.isoformat()
            and str(row.get("edition") or "").strip().lower() == cur_edition
        ):
            continue
        recent_rows.append(row)

    if not recent_rows:
        return []

    # Collect all referenced article IDs.
    all_ids: list[str] = []
    for row in recent_rows:
        ids = row.get("article_ids")
        if isinstance(ids, list):
            for aid in ids:
                s = str(aid).strip()
                if s:
                    all_ids.append(s)
    all_ids = list(dict.fromkeys(all_ids))
    if not all_ids:
        return []

    # Fetch titles/summaries for those articles in chunks.
    article_by_id: dict[str, dict[str, Any]] = {}
    try:
        for i in range(0, len(all_ids), 100):
            chunk = all_ids[i : i + 100]
            r = httpx.get(
                f"{base_url}/rest/v1/articles",
                params={
                    "select": "id,title,summary",
                    "id": f"in.({','.join(chunk)})",
                },
                headers=headers,
                timeout=20.0,
            )
            if not r.is_success:
                continue
            data = r.json()
            if not isinstance(data, list):
                continue
            for a in data:
                if not isinstance(a, dict) or not a.get("id"):
                    continue
                article_by_id[str(a["id"])] = a
    except Exception as exc:
        eprint(f"[podcast] warning: failed to fetch recent episode articles: {exc}")
        return []

    topics: list[_CoveredTopic] = []
    for row in recent_rows:
        try:
            ep_date = date.fromisoformat(str(row.get("date")))
        except Exception:
            continue
        ep_edition = str(row.get("edition") or "morning").strip().lower()
        ids = row.get("article_ids")
        if not isinstance(ids, list) or not ids:
            continue

        for aid in ids:
            art = article_by_id.get(str(aid))
            if not art:
                continue
            title = str(art.get("title") or "").strip()
            if not title:
                continue
            summary = str(art.get("summary") or "").strip()
            topics.append(
                _CoveredTopic(
                    title=title,
                    summary=summary,
                    episode_date=ep_date,
                    episode_edition=ep_edition,
                )
            )

    return topics


def _articles_similar(a: dict[str, Any], b: dict[str, Any]) -> bool:
    """Determine if two article dicts cover the same story.

    Signals (ordered by confidence):
    - Shared CVE ID => instant match
    - Title Jaccard >= 0.45 => match (keep current behavior)
    - Summary Jaccard >= 0.40 => match
    - Title Jaccard >= 0.30 AND summary Jaccard >= 0.25 => match
    - Shared entities (2+) AND a shared CVE/keyword => match
    """

    title_a = str(a.get("title") or "")
    title_b = str(b.get("title") or "")
    summary_a = str(a.get("summary") or "")
    summary_b = str(b.get("summary") or "")

    text_a = f"{title_a}\n{summary_a}".strip()
    text_b = f"{title_b}\n{summary_b}".strip()

    cves_a = _extract_cves(text_a)
    cves_b = _extract_cves(text_b)
    if cves_a and cves_b and (cves_a & cves_b):
        return True

    # Shared product or threat_actor entity = same story
    ent_a = {
        (e.get("type", ""), e.get("name", "").lower())
        for e in (a.get("entities") or [])
        if isinstance(e, dict) and e.get("type") in ("product", "threat_actor")
    }
    ent_b = {
        (e.get("type", ""), e.get("name", "").lower())
        for e in (b.get("entities") or [])
        if isinstance(e, dict) and e.get("type") in ("product", "threat_actor")
    }
    if ent_a and ent_b and (ent_a & ent_b):
        return True

    title_sim = _jaccard(_word_set(title_a), _word_set(title_b))
    if title_sim >= 0.45:
        return True

    summary_sim = _jaccard(_word_set(summary_a), _word_set(summary_b))
    if summary_sim >= 0.40:
        return True

    if title_sim >= 0.30 and summary_sim >= 0.25:
        return True

    # Entity + keyword/cve heuristic for differently-worded headlines
    entities_a = _extract_entities(text_a)
    entities_b = _extract_entities(text_b)
    shared_entities = len(entities_a & entities_b)

    kw_a = _extract_security_keywords(text_a)
    kw_b = _extract_security_keywords(text_b)
    shared_kw = len(kw_a & kw_b)

    if shared_entities >= 2 and (
        shared_kw >= 1 or (cves_a and cves_b and (cves_a & cves_b))
    ):
        return True

    return False


def _dedup_similar_articles(articles: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Remove duplicate articles covering the same story.

    Keeps the one with higher relevance_score (sorting first).
    Uses three signals:
    1. parent_article_id — if two articles share the same parent, they're updates of the same story
    2. Same parent — if article B's parent is article A (or vice versa), keep only the newer one
    3. Content similarity — Jaccard on titles/summaries + CVE matching
    """

    sorted_arts = sorted(
        articles, key=lambda x: int(x.get("relevance_score") or 0), reverse=True
    )

    kept: list[dict[str, Any]] = []
    kept_ids: set[str] = set()
    kept_parents: set[str] = set()

    for art in sorted_arts:
        art_id = str(art.get("id") or "")
        parent_id = str(art.get("parent_article_id") or "").strip()

        # Check 1: Is this article's parent already in kept?
        if parent_id and parent_id in kept_ids:
            continue

        # Check 2: Does this article share a parent with something already kept?
        if parent_id and parent_id in kept_parents:
            continue

        # Check 3: Is this article the parent of something already kept?
        if art_id and art_id in kept_parents:
            continue

        # Check 4: Content similarity (existing logic)
        if any(_articles_similar(art, k) for k in kept):
            continue

        kept.append(art)
        if art_id:
            kept_ids.add(art_id)
        if parent_id:
            kept_parents.add(parent_id)

    return kept


def _fetch_morning_article_ids(*, podcast_date: date) -> set[str]:
    """Fetch article IDs already used in this date's morning episode."""
    import httpx

    base_url = os.environ.get("SUPABASE_URL", DEFAULT_SUPABASE_URL).rstrip("/")
    service_key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not service_key:
        return set()

    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Accept": "application/json",
    }
    try:
        resp = httpx.get(
            f"{base_url}/rest/v1/podcast_episodes",
            params={
                "select": "article_ids",
                "date": f"eq.{podcast_date.isoformat()}",
                "edition": "eq.morning",
            },
            headers=headers,
            timeout=15.0,
        )
        if resp.is_success:
            rows = resp.json()
            if rows and isinstance(rows, list) and rows[0].get("article_ids"):
                ids = {str(aid) for aid in rows[0]["article_ids"]}
                eprint(f"[podcast] excluding {len(ids)} morning article IDs")
                return ids
    except Exception as exc:
        eprint(f"[podcast] warning: could not fetch morning article IDs: {exc}")
    return set()


def fetch_articles_for_podcast(
    *, podcast_date: date, edition: str = "morning"
) -> list[dict[str, Any]]:
    video_dir = PROJECT_ROOT / "scripts" / "video"
    sys.path.insert(0, str(video_dir))

    from fetch_articles import fetch_articles_with_metadata  # type: ignore

    base_url = os.environ.get("SUPABASE_URL", DEFAULT_SUPABASE_URL).rstrip("/")
    service_key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not service_key:
        raise RuntimeError("SUPABASE_SERVICE_KEY env var required")

    start_ts, end_ts = _get_edition_window(podcast_date, edition)
    eprint(f"[podcast] article window: {start_ts} → {end_ts} UTC")
    articles = fetch_articles_with_metadata(
        base_url=base_url,
        service_key=service_key,
        start_ts=start_ts,
        end_ts=end_ts,
        min_relevance_score=7,
    )

    # Afternoon edition: exclude articles already covered in the morning
    if edition == "afternoon":
        morning_ids = _fetch_morning_article_ids(podcast_date=podcast_date)
        if morning_ids:
            before = len(articles)
            articles = [a for a in articles if str(a.get("id")) not in morning_ids]
            eprint(
                f"[podcast] filtered {before - len(articles)} morning duplicates, {len(articles)} remaining"
            )

    # Deduplicate articles covering the same story from different sources
    before_dedup = len(articles)
    articles = _dedup_similar_articles(articles)
    if len(articles) < before_dedup:
        eprint(
            f"[podcast] deduped {before_dedup - len(articles)} similar articles, {len(articles)} remaining"
        )

    articles.sort(
        key=lambda x: (int(x.get("relevance_score") or 0), x.get("published_at") or ""),
        reverse=True,
    )

    # If not enough articles in the time window, fall back to top recent articles
    # This handles weekends and quiet periods
    if len(articles) < 4:
        eprint(
            f"[podcast] only {len(articles)} articles in window, fetching top recent as fallback"
        )
        # Widen window: last 48 hours
        from datetime import timezone as tz

        fallback_start = (
            datetime(
                podcast_date.year, podcast_date.month, podcast_date.day, tzinfo=tz.utc
            )
            - timedelta(hours=48)
        ).strftime("%Y-%m-%dT%H:%M:%S")
        fallback_end = end_ts

        fallback_articles = fetch_articles_with_metadata(
            base_url=base_url,
            service_key=service_key,
            start_ts=fallback_start,
            end_ts=fallback_end,
            min_relevance_score=6,
        )

        # Exclude already-selected and morning articles
        existing_ids = {str(a.get("id")) for a in articles}
        if edition == "afternoon":
            morning_ids_set = set(_fetch_morning_article_ids(podcast_date=podcast_date))
            existing_ids |= morning_ids_set

        fallback_articles = [
            a for a in fallback_articles if str(a.get("id")) not in existing_ids
        ]
        fallback_articles = _dedup_similar_articles(fallback_articles)
        fallback_articles.sort(
            key=lambda x: (
                int(x.get("relevance_score") or 0),
                x.get("published_at") or "",
            ),
            reverse=True,
        )

        # Ensure we have at least 4 articles
        needed = max(4 - len(articles), 0)
        if needed and fallback_articles:
            articles.extend(fallback_articles[:needed])
            eprint(
                f"[podcast] added {min(needed, len(fallback_articles))} fallback articles"
            )

    is_weekend = podcast_date.weekday() >= 5  # Saturday=5, Sunday=6
    max_articles = 8 if is_weekend else 4
    articles = articles[:max_articles]
    eprint(f"[podcast] fetched {len(articles)} approved articles ({edition} edition)")

    # Also fetch podcast_dialogue for these articles
    raw_article_ids = [str(a.get("id", "")) for a in articles if a.get("id")]
    article_ids: list[str] = []
    invalid_count = 0
    seen: set[str] = set()
    for aid in raw_article_ids:
        if not aid or aid in seen:
            continue
        try:
            uuid.UUID(aid)
        except Exception:
            invalid_count += 1
            continue
        seen.add(aid)
        article_ids.append(aid)

    if invalid_count:
        eprint(
            f"[podcast] warning: skipped {invalid_count} non-UUID article IDs during dialogue fetch"
        )

    if article_ids:
        import httpx

        base_url = os.environ.get("SUPABASE_URL", DEFAULT_SUPABASE_URL).rstrip("/")
        service_key = os.environ.get("SUPABASE_SERVICE_KEY")
        headers = {
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
        }
        # Fetch podcast_dialogue for these article IDs
        resp = httpx.get(
            f"{base_url}/rest/v1/articles",
            params={
                "select": "id,podcast_dialogue",
                "id": f"in.({','.join(article_ids)})",
                "podcast_dialogue": "not.is.null",
            },
            headers=headers,
            timeout=30.0,
        )
        if resp.status_code == 200:
            dialogue_map = {row["id"]: row["podcast_dialogue"] for row in resp.json()}
            for a in articles:
                aid = str(a.get("id", ""))
                if aid in dialogue_map:
                    a["podcast_dialogue"] = dialogue_map[aid]

    # Enrich with awareness lesson + IOC metadata for cross-promotion
    if article_ids:
        try:
            # Awareness lessons
            resp_aw = httpx.get(
                f"{base_url}/rest/v1/awareness_lessons",
                params={
                    "select": "article_id,title",
                    "article_id": f"in.({','.join(article_ids)})",
                    "status": "eq.published",
                },
                headers=headers,
                timeout=15.0,
            )
            if resp_aw.status_code == 200:
                aw_map = {
                    row["article_id"]: row.get("title", "")
                    for row in resp_aw.json()
                    if row.get("article_id")
                }
                for a in articles:
                    aid = str(a.get("id", ""))
                    if aid in aw_map:
                        a["has_awareness_lesson"] = True
                        a["awareness_title"] = aw_map[aid]

            # IOC counts
            resp_ioc = httpx.get(
                f"{base_url}/rest/v1/article_iocs",
                params={
                    "select": "article_id,type",
                    "article_id": f"in.({','.join(article_ids)})",
                },
                headers=headers,
                timeout=15.0,
            )
            if resp_ioc.status_code == 200:
                ioc_data: dict[str, dict[str, Any]] = {}
                for row in resp_ioc.json():
                    aid = row.get("article_id", "")
                    if not aid:
                        continue
                    if aid not in ioc_data:
                        ioc_data[aid] = {"count": 0, "types": set()}
                    ioc_data[aid]["count"] += 1
                    if row.get("type"):
                        ioc_data[aid]["types"].add(row["type"])
                for a in articles:
                    aid = str(a.get("id", ""))
                    if aid in ioc_data:
                        a["ioc_count"] = ioc_data[aid]["count"]
                        a["ioc_types"] = sorted(ioc_data[aid]["types"])

            # Add inline cross-promo hint so the model sees it with the article data
            for a in articles:
                hints: list[str] = []
                if a.get("has_awareness_lesson"):
                    hints.append(
                        "CROSS-PROMO: Mention our awareness page has a deeper breakdown on this story"
                    )
                if int(a.get("ioc_count") or 0) > 0:
                    hints.append(
                        f"CROSS-PROMO: Mention IOCs for this are on our IOC page ({int(a.get('ioc_count') or 0)} indicators)"
                    )
                if hints:
                    a["cross_promo_hint"] = " | ".join(hints)
        except Exception as exc:
            eprint(f"[podcast] warning: failed to enrich awareness/IOC data: {exc}")

    return articles


# ---------------------------------------------------------------------------
# Step 5: Upload to Cloudflare R2 (mirrors scripts/video/generate.py)
# ---------------------------------------------------------------------------


def _get_r2_client() -> Any:
    """Create boto3 S3 client configured for Cloudflare R2."""
    import boto3

    access_key = os.environ.get("R2_ACCESS_KEY_ID")
    secret_key = os.environ.get("R2_SECRET_ACCESS_KEY")
    endpoint = os.environ.get("R2_ENDPOINT")

    if not all([access_key, secret_key, endpoint]):
        raise RuntimeError(
            "R2 credentials required: set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT"
        )

    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name="auto",
    )


def upload_to_r2(local_path: str, r2_key: str, content_type: str = "audio/mpeg") -> str:
    """Upload a file to R2 and return the public URL."""
    client = _get_r2_client()
    client.upload_file(
        local_path,
        R2_BUCKET,
        r2_key,
        ExtraArgs={"ContentType": content_type},
    )
    url = f"{R2_PUBLIC_BASE}/{r2_key}"
    eprint(f"[podcast] uploaded to R2: {url}")
    return url


# ---------------------------------------------------------------------------
# Step 6: Record in Supabase
# ---------------------------------------------------------------------------


def record_episode(
    *,
    date_str: str,
    edition: str,
    title: str,
    article_text: str | None,
    duration_seconds: int | None,
    audio_url: str,
    article_count: int,
    article_ids: list[str],
    dialogue: dict[str, Any],
    cost_cents: float,
    total_characters: int,
) -> None:
    import httpx

    base_url = os.environ.get("SUPABASE_URL", DEFAULT_SUPABASE_URL).rstrip("/")
    service_key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not service_key:
        raise RuntimeError("SUPABASE_SERVICE_KEY required for DB recording")

    row = {
        "date": date_str,
        "edition": edition,
        "title": title,
        "article_text": article_text,
        "duration_seconds": duration_seconds,
        "audio_url": audio_url,
        "article_count": article_count,
        "article_ids": article_ids,
        "dialogue": dialogue,
        "cost_cents": round(float(cost_cents), 2),
        "total_characters": int(total_characters),
    }

    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }

    resp = httpx.post(
        f"{base_url}/rest/v1/podcast_episodes?on_conflict=date,edition",
        headers=headers,
        json=row,
        timeout=30.0,
    )
    if resp.status_code >= 400:
        eprint(f"[podcast] DB insert warning: {resp.status_code} {resp.text[:300]}")
    else:
        eprint(f"[podcast] recorded episode: {date_str} ({edition})")


# ---------------------------------------------------------------------------
# Step 7: Discord notification
# ---------------------------------------------------------------------------


def send_discord_notification(
    *,
    date_str: str,
    edition: str,
    article_count: int,
    duration_seconds: int,
    audio_url: str,
) -> None:
    try:
        send_script = Path.home() / "projects" / "discord-odin" / "send_dm.py"
        python_bin = (
            Path.home() / "projects" / "discord-odin" / "venv" / "bin" / "python"
        )

        if not send_script.exists() or not python_bin.exists():
            eprint("[podcast] Discord DM script/venv not found; skipping notification")
            return

        label = EDITION_LABELS.get(edition, edition.title())
        mins = max(1, int(round(duration_seconds / 60.0)))
        message = (
            f"🎙️ ThreatNoir {label} — {date_str}\n"
            f"{article_count} stories | {mins}min\n"
            f"{audio_url}"
        )

        subprocess.run(
            [str(python_bin), str(send_script), "--message", message],
            timeout=30,
            capture_output=True,
        )
        eprint("[podcast] Discord notification sent")
    except Exception as exc:
        eprint(f"[podcast] Discord notification failed: {exc}")


def send_discord_failure_notification(
    *,
    date_str: str,
    edition: str,
    error: str,
    is_permanent: bool = False,
) -> None:
    """Page Marcus via Discord DM when podcast generation fails.
    Non-blocking: failures here are logged but never raised."""
    try:
        send_script = Path.home() / "projects" / "discord-odin" / "send_dm.py"
        python_bin = Path.home() / "projects" / "discord-odin" / "venv" / "bin" / "python"

        if not send_script.exists() or not python_bin.exists():
            eprint(
                "[podcast] Discord DM script/venv not found; skipping failure notification"
            )
            return

        label = EDITION_LABELS.get(edition, edition.title())
        err_trimmed = (error or "")[:800]
        severity = (
            "PERMANENT (manual fix needed)"
            if is_permanent
            else "TRANSIENT (will retry next run)"
        )
        message = (
            f"🚨 ThreatNoir {label} — {date_str} FAILED\n"
            f"{severity}\n"
            f"\n"
            f"{err_trimmed}\n"
            f"\n"
            f"Log: /tmp/threatnoir-podcast.log"
        )

        subprocess.run(
            [str(python_bin), str(send_script), "--message", message],
            timeout=30,
            capture_output=True,
        )
        eprint("[podcast] Discord failure DM sent")
    except Exception as exc:
        eprint(f"[podcast] Discord failure notification crashed: {exc}")


def post_to_alerts_channel(content: str) -> None:
    """Post to #alerts via Discord bot token. Non-blocking."""
    try:
        import json as _json
        import os
        import urllib.request

        token = os.environ.get("DISCORD_BOT_TOKEN", "").strip()
        if not token:
            eprint("[podcast] DISCORD_BOT_TOKEN not set; skipping #alerts post")
            return

        channel_id = os.environ.get("DISCORD_ALERTS_CHANNEL_ID", "").strip()
        if not channel_id:
            eprint("[podcast] DISCORD_ALERTS_CHANNEL_ID not set; skipping #alerts post")
            return
        req = urllib.request.Request(
            f"https://discord.com/api/v10/channels/{channel_id}/messages",
            data=_json.dumps({"content": content[:1900]}).encode(),
            method="POST",
            headers={
                "Authorization": f"Bot {token}",
                "Content-Type": "application/json",
            },
        )
        urllib.request.urlopen(req, timeout=10).read()
        eprint("[podcast] #alerts post sent")
    except Exception as exc:
        eprint(f"[podcast] alerts channel post failed: {exc}")


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------


def main(
    date_str: str | None = None,
    dry_run: bool = False,
    edition: str = "morning",
    max_articles: int | None = None,
    engine: str = "elevenlabs",
) -> RunResult:
    podcast_date = _parse_podcast_date(date_str)
    date_s = podcast_date.isoformat()
    label = EDITION_LABELS.get(edition, edition.title())

    eprint(f"\n{'=' * 60}")
    start_ts, end_ts = _get_edition_window(podcast_date, edition)
    eprint(
        f"[podcast] starting {edition} edition for {date_s} (window {start_ts} → {end_ts} UTC)"
    )
    eprint(f"{'=' * 60}\n")

    # Step 1
    articles = fetch_articles_for_podcast(podcast_date=podcast_date, edition=edition)
    if max_articles and len(articles) > max_articles:
        articles = articles[:max_articles]
        eprint(f"[podcast] limited to {max_articles} articles (--max-articles)")
    if not articles:
        eprint("[podcast] no articles found; nothing to generate")
        return RunResult(
            date_str=date_s,
            article_count=0,
            duration_seconds=None,
            audio_url=None,
            cost_usd=0.0,
            total_characters=0,
        )

    # Step 1b: Cross-episode continuity context
    recently_covered = _fetch_recent_covered_topics(
        podcast_date=podcast_date,
        edition=edition,
        lookback_days=3,
    )
    previously_covered = _build_previously_covered_lines(
        today_articles=articles,
        covered_topics=recently_covered,
        current_date=podcast_date,
        current_edition=edition,
    )
    if previously_covered:
        eprint(
            f"[podcast] continuity: {len(previously_covered)} recurring topic(s) detected"
        )

    # Step 2: Generate or assemble dialogue
    from generate_dialogue import (
        generate_dialogue,
        usage_to_cost_usd,
    )  # type: ignore

    from generate_article import generate_article  # type: ignore

    # Always generate full episode dialogue from scratch via Claude Opus.
    # The per-article podcast_dialogue cache (assemble_dialogue path) produced lower
    # quality: stitched segments, no cross-article context, Haiku-quality lines.
    eprint("[podcast] generating full episode dialogue")
    recent_intros = _fetch_recent_intros(podcast_date)

    dialogue = None
    usage = None
    for attempt in range(1, MAX_DIALOGUE_RETRIES + 1):
        try:
            dialogue, usage = generate_dialogue(
                articles=articles,
                date_str=date_s,
                edition=edition,
                previously_covered=previously_covered,
                previous_intros=recent_intros,
            )
            if attempt > 1:
                eprint(
                    f"[podcast] dialogue generation succeeded on attempt {attempt}/{MAX_DIALOGUE_RETRIES}"
                )
            break
        except Exception as exc:
            if not _should_retry_dialogue(exc):
                eprint(
                    "[podcast] dialogue generation failed with permanent error; not retrying: "
                    f"{type(exc).__name__}: {exc}"
                )
                raise
            if attempt >= MAX_DIALOGUE_RETRIES:
                eprint(
                    f"[podcast] dialogue generation failed after {MAX_DIALOGUE_RETRIES} attempts; giving up"
                )
                raise

            eprint(
                f"[podcast] dialogue generation failed on attempt {attempt}/{MAX_DIALOGUE_RETRIES}: "
                f"{type(exc).__name__}: {exc}"
            )
            eprint(
                f"[podcast] waiting {DIALOGUE_RETRY_BACKOFF_SECONDS}s before retry {attempt + 1}/{MAX_DIALOGUE_RETRIES}"
            )
            time.sleep(DIALOGUE_RETRY_BACKOFF_SECONDS)

    haiku_cost_usd = usage_to_cost_usd(usage)
    eprint(f"[podcast] dialogue generated. est_haiku_cost=${haiku_cost_usd:.4f}")

    # Step 2b: Generate written article
    eprint("[podcast] generating written article...")
    article_text, article_usage = generate_article(
        articles=articles, date_str=date_s, edition=edition
    )
    article_cost_usd = usage_to_cost_usd(article_usage)
    eprint(f"[podcast] article generated. est_haiku_cost=${article_cost_usd:.4f}")

    if dry_run:
        json.dump(dialogue, sys.stdout, ensure_ascii=False, indent=2)
        sys.stdout.write("\n")

        # Print article to stderr to preserve JSON-on-stdout behavior.
        eprint("\n" + ("-" * 60))
        eprint("[podcast] ARTICLE MARKDOWN (dry-run)")
        eprint(("-" * 60) + "\n")
        eprint(article_text.rstrip() + "\n")
        return RunResult(
            date_str=date_s,
            article_count=len(articles),
            duration_seconds=None,
            audio_url=None,
            cost_usd=haiku_cost_usd + article_cost_usd,
            total_characters=0,
        )

    with tempfile.TemporaryDirectory(prefix=f"threatnoir-podcast-{date_s}-") as tmp:
        tmp_dir = Path(tmp)
        lines_dir = tmp_dir / "lines"
        out_mp3 = tmp_dir / f"threatnoir-{edition}-brief-{date_s}.mp3"

        eprint(f"[podcast] TTS engine: {engine}")
        if engine == "wondercraft":
            from wondercraft import synthesize_wondercraft  # type: ignore

            eprint("[podcast] Using Wondercraft TTS engine")
            wc_result = synthesize_wondercraft(dialogue, str(out_mp3))
            duration_seconds = wc_result["duration_seconds"]
            total_chars = wc_result["total_characters"]
            tts_cost_usd = 0.0  # Wondercraft pricing TBD
            eprint(
                f"[podcast] Wondercraft complete: duration={duration_seconds}s chars={total_chars}"
            )

        elif engine == "elevenlabs-dialogue":
            from elevenlabs_dialogue import synthesize_elevenlabs_dialogue  # type: ignore

            eprint("[podcast] Using ElevenLabs Text to Dialogue engine")
            el_result = synthesize_elevenlabs_dialogue(dialogue, str(out_mp3))
            duration_seconds = el_result["duration_seconds"]
            total_chars = el_result["total_characters"]
            tts_cost_usd = total_chars / 1000 * 0.018  # v3 pricing TBD, using v2 rate
            eprint(
                f"[podcast] ElevenLabs Dialogue complete: duration={duration_seconds}s chars={total_chars}"
            )

        else:
            # Step 3
            from synthesize import estimate_tts_cost_usd, synthesize_dialogue  # type: ignore

            audio_files, total_chars = synthesize_dialogue(
                dialogue=dialogue, output_dir=str(lines_dir)
            )
            tts_cost_usd = estimate_tts_cost_usd(
                total_chars
            )  # uses DEFAULT_ENGINE cost
            eprint(
                f"[podcast] TTS complete: lines={len(audio_files)} total_chars={total_chars} est_tts_cost=${tts_cost_usd:.4f}"
            )

            # Step 4
            from mix import mix_episode  # type: ignore

            jingle = SCRIPT_DIR / "assets" / "intro_jingle.mp3"
            mix_result = mix_episode(
                audio_dir=str(lines_dir),
                output_path=str(out_mp3),
                jingle_path=str(jingle) if jingle.exists() else None,
            )
            duration_seconds = int(mix_result.get("duration_seconds") or 0)

        # Step 5
        r2_key = f"podcasts/{date_s}/threatnoir-{edition}-brief-{date_s}.mp3"
        audio_url = upload_to_r2(str(out_mp3), r2_key, content_type="audio/mpeg")

        # Step 6
        article_ids = [str(a.get("id", "")) for a in articles if a.get("id")]
        cost_usd_total = haiku_cost_usd + article_cost_usd + tts_cost_usd
        cost_cents = cost_usd_total * 100
        record_episode(
            date_str=date_s,
            edition=edition,
            title=str(dialogue.get("title") or f"ThreatNoir {label} — {date_s}"),
            article_text=article_text,
            duration_seconds=duration_seconds,
            audio_url=audio_url,
            article_count=len(articles),
            article_ids=article_ids,
            dialogue=dialogue,
            cost_cents=cost_cents,
            total_characters=total_chars,
        )

        # Step 7
        send_discord_notification(
            date_str=date_s,
            edition=edition,
            article_count=len(articles),
            duration_seconds=duration_seconds,
            audio_url=audio_url,
        )

        eprint(f"\n[podcast] complete. url={audio_url}")
        return RunResult(
            date_str=date_s,
            article_count=len(articles),
            duration_seconds=duration_seconds,
            audio_url=audio_url,
            cost_usd=cost_usd_total,
            total_characters=total_chars,
        )


def parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="ThreatNoir Podcast generator")
    p.add_argument(
        "--date",
        help="Podcast date (YYYY-MM-DD). Defaults to today (UTC).",
    )
    p.add_argument(
        "--edition",
        choices=["morning", "afternoon"],
        default="morning",
        help="Edition: morning (default) or afternoon.",
    )
    p.add_argument(
        "--engine",
        choices=["elevenlabs", "elevenlabs-dialogue", "wondercraft"],
        default=None,
        help="TTS engine. Default: elevenlabs-dialogue for morning, wondercraft for afternoon.",
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="Dialogue only: skip TTS/upload/DB/Discord",
    )
    p.add_argument(
        "--max-articles",
        type=int,
        help="Limit number of articles (for cheap iteration tests)",
    )
    return p.parse_args(argv)


def cli(argv: list[str]) -> int:
    args = parse_args(argv)
    # Capture for failure notifications before entering the main pipeline.
    date_str = str(args.date) if args.date else datetime.now(timezone.utc).date().isoformat()
    edition = str(args.edition)
    try:
        engine = args.engine or (
            "wondercraft" if str(args.edition) == "afternoon" else "elevenlabs-dialogue"
        )
        res = main(
            date_str=str(args.date) if args.date else None,
            dry_run=bool(args.dry_run),
            edition=str(args.edition),
            max_articles=args.max_articles,
            engine=str(engine),
        )
        if args.dry_run:
            return 0
        return 0 if res.audio_url else 1
    except Exception as exc:
        err_str = str(exc) or repr(exc)
        err_lower = err_str.lower()
        is_permanent = (
            "api usage limits" in err_lower
            or "invalid_request_error" in err_lower
            or "401" in err_lower
            or "403" in err_lower
            or "content_policy" in err_lower
            or "model_not_found" in err_lower
        )
        send_discord_failure_notification(
            date_str=date_str,
            edition=edition,
            error=err_str,
            is_permanent=is_permanent,
        )
        severity = "PERMANENT" if is_permanent else "TRANSIENT"
        post_to_alerts_channel(
            f"🚨 ThreatNoir podcast {edition} {date_str} FAILED ({severity})\n"
            f"{err_str[:1500]}"
        )
        eprint(f"[podcast] ERROR: {exc}")
        traceback.print_exc(file=sys.stderr)
        return 1


if __name__ == "__main__":  # pragma: no cover
    # Add scripts/podcast to sys.path so we can import sibling modules.
    sys.path.insert(0, str(SCRIPT_DIR))
    raise SystemExit(cli(sys.argv[1:]))
