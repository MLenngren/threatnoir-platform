#!/usr/bin/env python3
"""Backfill unpublished SOC video briefings to YouTube (LEN-1761)."""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import urllib.parse
import urllib.request
from typing import Any


def log(*args: object) -> None:
    print("[backfill_briefings]", *args, flush=True)


def _require_env(name: str) -> str:
    v = (os.environ.get(name) or "").strip()
    if not v:
        raise RuntimeError(f"Missing env var: {name}")
    return v


def _supabase_headers(service_key: str) -> dict[str, str]:
    return {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Accept": "application/json",
    }


def _url(base: str, path: str, params: dict[str, str]) -> str:
    q = urllib.parse.urlencode(params, safe="(),.:*")
    return f"{base.rstrip('/')}{path}?{q}"


def _get_rows(*, base_url: str, service_key: str, limit: int) -> list[dict[str, Any]]:
    params = {
        "select": "id,date,title",
        "youtube_video_id": "is.null",
        "video_url": "not.is.null",
        "order": "date.asc",
        "limit": str(limit),
    }
    req = urllib.request.Request(
        _url(base_url, "/rest/v1/video_briefings", params),
        headers=_supabase_headers(service_key),
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        payload = resp.read().decode("utf-8")
    data = json.loads(payload or "[]")
    if not isinstance(data, list):
        raise RuntimeError("Unexpected response from Supabase")
    return [r for r in data if isinstance(r, dict)]


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Backfill YouTube uploads for video_briefings")
    ap.add_argument("--limit", type=int, default=5)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args(argv)

    base_url = _require_env("SUPABASE_URL").rstrip("/")
    service_key = _require_env("SUPABASE_SERVICE_KEY")

    rows = _get_rows(base_url=base_url, service_key=service_key, limit=int(args.limit))
    if args.dry_run:
        for r in rows:
            log(f"would upload: {r.get('date')} {r.get('id')} — {r.get('title')}")
        log(f"dry-run complete ({len(rows)} rows)")
        return 0

    attempted = 0
    succeeded = 0
    skipped = 0
    errored = 0

    for r in rows:
        bid = str(r.get("id") or "").strip()
        if not bid:
            continue
        attempted += 1
        log(f"publishing {bid} ({r.get('date')}): {r.get('title')}")
        proc = subprocess.run(
            [
                sys.executable,
                "scripts/youtube/publish_briefing.py",
                "--briefing-id",
                bid,
            ],
            check=False,
        )

        if proc.returncode == 2:
            log("stopping — quota exhausted, resume tomorrow")
            break
        if proc.returncode == 0:
            succeeded += 1
        else:
            errored += 1

    log(
        "summary:",
        f"attempted={attempted}",
        f"succeeded={succeeded}",
        f"skipped={skipped}",
        f"errored={errored}",
    )
    return 0 if errored == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
