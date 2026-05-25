"""Fetch approved ThreatNoir articles for a date and route them to video audiences.

This script uses Supabase PostgREST (REST) endpoints with a service role key.
It outputs a JSON object to stdout with up to three audience buckets:
  - executive
  - soc
  - engineer

Buckets with fewer than 3 routed articles are omitted from the output.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Any, DefaultDict, Iterable

import httpx


SUPABASE_REF = (os.environ.get("SUPABASE_URL") or "").replace("https://", "").replace("http://", "").split(".")[0]
if not SUPABASE_REF:
    raise SystemExit("SUPABASE_URL env var required (e.g. https://abcdefgh.supabase.co)")
DEFAULT_SUPABASE_URL = f"https://{SUPABASE_REF}.supabase.co"


AUDIENCE_CATEGORIES: dict[str, list[str]] = {
    "executive": [
        "policy",
        "compliance",
        "breaches",
        "ransomware",
        "nation-state",
        "privacy",
    ],
    "soc": [
        "threat-intelligence",
        "malware",
        "ransomware",
        "nation-state",
        "zero-day",
        "incident-response",
    ],
    "engineer": [
        "vulnerabilities",
        "tools",
        "cloud-security",
        "open-source",
        "identity-access",
        "iot-ot",
        "cryptography",
        "ai-security",
    ],
}


@dataclass(frozen=True)
class Ioc:
    type: str
    value: str


def _parse_date_arg(value: str | None) -> date:
    if value in (None, "", "yesterday"):
        # Use UTC to match Supabase timestamps.
        today_utc = datetime.now(timezone.utc).date()
        return today_utc - timedelta(days=1)

    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise SystemExit(
            f"Invalid --date '{value}'. Use YYYY-MM-DD or 'yesterday'."
        ) from exc


def _iso_day_range(d: date) -> tuple[str, str]:
    start = datetime(d.year, d.month, d.day, tzinfo=timezone.utc)
    end = start + timedelta(days=1)
    # PostgREST expects timestamps like 2026-03-14T00:00:00 (timezone-less is OK); keep UTC.
    return (
        start.strftime("%Y-%m-%dT%H:%M:%S"),
        end.strftime("%Y-%m-%dT%H:%M:%S"),
    )


def _supabase_headers(service_key: str) -> dict[str, str]:
    return {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Accept": "application/json",
    }


def _raise_for_status(resp: httpx.Response) -> None:
    if resp.is_success:
        return
    details: str
    try:
        payload = resp.json()
        details = json.dumps(payload, ensure_ascii=False)
    except Exception:
        details = resp.text
    raise RuntimeError(f"Supabase request failed ({resp.status_code}): {details}")


def _get(
    client: httpx.Client,
    base_url: str,
    table: str,
    params: dict[str, str],
) -> list[dict[str, Any]]:
    url = f"{base_url}/rest/v1/{table}"
    resp = client.get(url, params=params)
    _raise_for_status(resp)
    data = resp.json()
    if not isinstance(data, list):
        raise RuntimeError(f"Unexpected response for {table}: expected list")
    return data


def _chunked(values: list[str], size: int) -> Iterable[list[str]]:
    for i in range(0, len(values), size):
        yield values[i : i + size]


def _fetch_articles_base(
    client: httpx.Client,
    base_url: str,
    *,
    start_ts: str,
    end_ts: str,
    min_relevance_score: int,
) -> list[dict[str, Any]]:
    url = f"{base_url}/rest/v1/articles"
    params = [
        (
            "select",
            "id,title,summary,url,image_url,relevance_score,published_at,created_at,parent_article_id,entities",
        ),
        ("status", "eq.approved"),
        ("relevance_score", f"gte.{min_relevance_score}"),
        ("published_at", f"gte.{start_ts}"),
        ("published_at", f"lt.{end_ts}"),
    ]
    resp = client.get(url, params=params)
    _raise_for_status(resp)
    data = resp.json()
    if not isinstance(data, list):
        raise RuntimeError("Unexpected articles response: expected list")
    return data


def _fetch_article_tags(
    client: httpx.Client,
    base_url: str,
    article_ids: list[str],
) -> list[dict[str, Any]]:
    # Chunk to keep URL length reasonable.
    rows: list[dict[str, Any]] = []
    for chunk in _chunked(article_ids, 100):
        rows.extend(
            _get(
                client,
                base_url,
                "article_tags",
                params={
                    "select": "article_id,category_id",
                    "article_id": f"in.({','.join(chunk)})",
                },
            )
        )
    return rows


def _fetch_categories_by_ids(
    client: httpx.Client,
    base_url: str,
    category_ids: list[str],
) -> dict[str, dict[str, Any]]:
    if not category_ids:
        return {}
    # Deduplicate.
    ids = sorted(set(category_ids))
    out: dict[str, dict[str, Any]] = {}
    for chunk in _chunked(ids, 200):
        rows = _get(
            client,
            base_url,
            "categories",
            params={
                "select": "id,slug,name",
                "id": f"in.({','.join(chunk)})",
            },
        )
        for row in rows:
            if isinstance(row, dict) and "id" in row:
                out[str(row["id"])] = row
    return out


def _fetch_article_iocs(
    client: httpx.Client,
    base_url: str,
    article_ids: list[str],
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for chunk in _chunked(article_ids, 100):
        rows.extend(
            _get(
                client,
                base_url,
                "article_iocs",
                params={
                    "select": "article_id,type,value",
                    "article_id": f"in.({','.join(chunk)})",
                },
            )
        )
    return rows


def fetch_articles_with_metadata(
    *,
    base_url: str,
    service_key: str,
    target_date: date | None = None,
    min_relevance_score: int = 7,
    start_ts: str | None = None,
    end_ts: str | None = None,
) -> list[dict[str, Any]]:
    """Fetch approved articles and attach categories (slugs) and IOCs.

    Either pass target_date (full UTC day) or explicit start_ts/end_ts.
    """

    if start_ts and end_ts:
        pass  # use caller-provided range
    elif target_date:
        start_ts, end_ts = _iso_day_range(target_date)
    else:
        raise ValueError("Either target_date or start_ts/end_ts must be provided")
    with httpx.Client(headers=_supabase_headers(service_key), timeout=30.0) as client:
        articles = _fetch_articles_base(
            client,
            base_url,
            start_ts=start_ts,
            end_ts=end_ts,
            min_relevance_score=min_relevance_score,
        )

        article_ids = [str(a.get("id")) for a in articles if a.get("id")]
        if not article_ids:
            return []

        tag_rows = _fetch_article_tags(client, base_url, article_ids)
        category_id_by_article: DefaultDict[str, list[str]] = defaultdict(list)
        category_ids: list[str] = []
        for row in tag_rows:
            aid = row.get("article_id")
            tid = row.get("category_id")
            if aid and tid:
                aid_s = str(aid)
                tid_s = str(tid)
                category_id_by_article[aid_s].append(tid_s)
                category_ids.append(tid_s)

        categories_by_id = _fetch_categories_by_ids(client, base_url, category_ids)

        ioc_rows = _fetch_article_iocs(client, base_url, article_ids)
        iocs_by_article: DefaultDict[str, list[Ioc]] = defaultdict(list)
        for row in ioc_rows:
            aid = row.get("article_id")
            t = row.get("type")
            v = row.get("value")
            if aid and t and v:
                iocs_by_article[str(aid)].append(Ioc(type=str(t), value=str(v)))

    enriched: list[dict[str, Any]] = []
    for a in articles:
        aid = str(a.get("id"))
        cat_slugs: list[str] = []
        for cid in category_id_by_article.get(aid, []):
            cat = categories_by_id.get(cid)
            slug = (cat or {}).get("slug")
            if slug:
                cat_slugs.append(str(slug))
        # stable unique
        cat_slugs = sorted(set(cat_slugs))

        iocs = iocs_by_article.get(aid, [])
        enriched.append(
            {
                "id": aid,
                "title": a.get("title"),
                "summary": a.get("summary"),
                "url": a.get("url"),
                "image_url": a.get("image_url"),
                "relevance_score": a.get("relevance_score"),
                "entities": a.get("entities") or [],
                "categories": cat_slugs,
                "iocs": [{"type": i.type, "value": i.value} for i in iocs],
            }
        )
    return enriched


def route_by_audience(
    articles: list[dict[str, Any]],
) -> dict[str, list[dict[str, Any]]]:
    """Route enriched articles into audience buckets per LEN-1068 rules."""

    buckets: dict[str, list[dict[str, Any]]] = {
        "executive": [],
        "soc": [],
        "engineer": [],
    }
    seen: dict[str, set[str]] = {"executive": set(), "soc": set(), "engineer": set()}

    def add(bucket: str, article: dict[str, Any]) -> None:
        aid = str(article.get("id"))
        if not aid or aid in seen[bucket]:
            return
        seen[bucket].add(aid)
        buckets[bucket].append(article)

    exec_slugs = set(AUDIENCE_CATEGORIES["executive"])
    soc_slugs = set(AUDIENCE_CATEGORIES["soc"])
    eng_slugs = set(AUDIENCE_CATEGORIES["engineer"])

    for a in articles:
        cats = set(a.get("categories") or [])
        score = a.get("relevance_score")
        try:
            score_i = int(score)
        except Exception:
            score_i = 0

        has_iocs = bool(a.get("iocs"))

        if cats & exec_slugs:
            add("executive", a)
        if score_i >= 9:
            add("executive", a)

        if cats & soc_slugs:
            add("soc", a)
        if has_iocs:
            add("soc", a)

        if cats & eng_slugs:
            add("engineer", a)

    # Sort each bucket by relevance_score descending.
    for b in buckets:
        buckets[b].sort(key=lambda x: int(x.get("relevance_score") or 0), reverse=True)

    # Skip buckets with < 3 articles.
    return {k: v for k, v in buckets.items() if len(v) >= 3}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Fetch approved articles and route by audience"
    )
    parser.add_argument(
        "--date",
        default="yesterday",
        help="Target date in YYYY-MM-DD (UTC) or 'yesterday' (default)",
    )
    args = parser.parse_args(argv)

    target = _parse_date_arg(args.date)

    base_url = os.environ.get("SUPABASE_URL", DEFAULT_SUPABASE_URL).rstrip("/")
    service_key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not service_key:
        print(
            "Missing SUPABASE_SERVICE_KEY env var (service role key required for REST queries).",
            file=sys.stderr,
        )
        return 2

    try:
        articles = fetch_articles_with_metadata(
            base_url=base_url,
            service_key=service_key,
            target_date=target,
            min_relevance_score=7,
        )
        routed = route_by_audience(articles)
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        return 1

    sys.stdout.write(json.dumps(routed, ensure_ascii=False, indent=2))
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
