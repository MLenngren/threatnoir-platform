#!/usr/bin/env python3
"""Publish a ThreatNoir SOC video briefing to YouTube (LEN-1761).

IMPORTANT:
- Idempotency is via `video_briefings.youtube_video_id`.
- This script uploads regular (landscape) videos (not Shorts).
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import random
import sys
import tempfile
import time
import traceback
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any


SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]


def log(*args: object) -> None:
    print("[publish_briefing]", *args, flush=True)


def _load_dotenv_if_present() -> None:
    """Best-effort load of .env into os.environ.

    - Uses python-dotenv if available.
    - Otherwise parses a minimal KEY=VALUE format.
    """

    candidates: list[Path] = []
    # Prefer repo root (.env alongside package.json).
    try:
        repo_root = Path(__file__).resolve().parents[2]
        candidates.append(repo_root / ".env")
    except Exception:
        pass

    candidates.append(Path.cwd() / ".env")

    env_path = next((p for p in candidates if p.exists() and p.is_file()), None)
    if not env_path:
        return

    try:
        from dotenv import load_dotenv  # type: ignore

        load_dotenv(dotenv_path=env_path)
        log(f"loaded env from {env_path}")
        return
    except Exception:
        # Fall back to a tiny parser.
        pass

    try:
        raw = env_path.read_text(encoding="utf-8")
        loaded = 0
        for line in raw.splitlines():
            s = line.strip()
            if not s or s.startswith("#") or "=" not in s:
                continue
            k, v = s.split("=", 1)
            key = k.strip()
            val = v.strip().strip("\"'")
            if key and key not in os.environ:
                os.environ[key] = val
                loaded += 1
        if loaded:
            log(f"loaded {loaded} env vars from {env_path}")
    except Exception as e:
        log(f"warning: failed to parse {env_path}: {e}")


def _require_env(name: str) -> str:
    v = (os.environ.get(name) or "").strip()
    if not v:
        raise RuntimeError(f"Missing env var: {name}")
    return v


def _require_env(name: str) -> str:
    """Read an env var; raise if unset."""
    v = (os.environ.get(name) or "").strip()
    if not v:
        raise RuntimeError(f"Missing required env var: {name}")
    return v


def _supabase_headers(service_key: str) -> dict[str, str]:
    return {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Accept": "application/json",
    }


def _url(base: str, path: str, params: dict[str, str] | None = None) -> str:
    base_clean = base.rstrip("/")
    u = f"{base_clean}{path}"
    if not params:
        return u
    # Keep PostgREST operators readable (eq., in.(...), is.null, etc.)
    q = urllib.parse.urlencode(params, safe="(),.:*" )
    return f"{u}?{q}"


def _supabase_get_json_list(
    *, base_url: str, table: str, params: dict[str, str], service_key: str
) -> list[dict[str, Any]]:
    req = urllib.request.Request(
        _url(base_url, f"/rest/v1/{table}", params),
        headers=_supabase_headers(service_key),
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        payload = resp.read().decode("utf-8")
    data = json.loads(payload or "[]")
    if isinstance(data, list):
        return [r for r in data if isinstance(r, dict)]
    raise RuntimeError(f"Unexpected Supabase response shape (expected list), got: {type(data)}")


def _supabase_patch(
    *, base_url: str, table: str, eq_id: str, body: dict[str, Any], service_key: str
) -> None:
    url = _url(base_url, f"/rest/v1/{table}", {"id": f"eq.{eq_id}"})
    data = json.dumps(body).encode("utf-8")
    headers = {
        **_supabase_headers(service_key),
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }
    req = urllib.request.Request(url, headers=headers, data=data, method="PATCH")
    with urllib.request.urlopen(req, timeout=30) as resp:
        if resp.status >= 400:
            raise RuntimeError(f"Supabase PATCH failed: HTTP {resp.status}")


def _download(url: str, suffix: str) -> str:
    fd, path = tempfile.mkstemp(prefix="threatnoir-", suffix=suffix)
    os.close(fd)
    log(f"downloading: {url}")
    # Cloudflare on cdn.threatnoir.com 403s the default Python-urllib UA. Use a browser-like UA.
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 ThreatNoir-Publisher/1.0"})
    with urllib.request.urlopen(req, timeout=120) as resp, open(path, "wb") as out:
        while True:
            chunk = resp.read(64 * 1024)
            if not chunk:
                break
            out.write(chunk)
    return path


def _parse_quota_exceeded(e: Exception) -> bool:
    # googleapiclient.errors.HttpError has `content` bytes containing JSON.
    content = getattr(e, "content", None)
    if not content:
        return False
    try:
        raw = content.decode("utf-8") if isinstance(content, (bytes, bytearray)) else str(content)
        obj = json.loads(raw)
        reason = (
            obj.get("error", {})
            .get("errors", [{}])[0]
            .get("reason")
        )
        return reason == "quotaExceeded"
    except Exception:
        return False


def _build_description(*, summary: str, slug: str, articles: list[dict[str, Any]]) -> str:
    parts: list[str] = []
    if summary.strip():
        parts.append(summary.strip())
    parts.append("")
    parts.append(f"Watch on ThreatNoir: https://threatnoir.com/show/{slug}")
    if articles:
        parts.append("")
        parts.append("Sources cited:")
        for a in articles:
            title = str(a.get("title") or "").strip()
            url = str(a.get("url") or "").strip()
            if title and url:
                parts.append(f"- {title}: {url}")
    return "\n".join(parts).strip() + "\n"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Publish a ThreatNoir SOC video briefing to YouTube"
    )
    g = parser.add_mutually_exclusive_group(required=True)
    g.add_argument("--briefing-id", help="video_briefings.id (uuid)")
    g.add_argument("--date", help="YYYY-MM-DD")
    parser.add_argument("--audience", default="soc", help="Audience (default: soc)")
    parser.add_argument("--force", action="store_true", help="Upload even if youtube_video_id is set")
    args = parser.parse_args(argv)

    _load_dotenv_if_present()

    # Resolve DB credentials
    base_url = _require_env("SUPABASE_URL").rstrip("/")
    service_key = _require_env("SUPABASE_SERVICE_KEY")

    temp_paths: list[str] = []

    try:
        # 1) Fetch briefing row
        select_cols = "id,date,title,slug,summary,video_url,thumbnail_url,article_ids,audience,youtube_video_id"
        if args.briefing_id:
            rows = _supabase_get_json_list(
                base_url=base_url,
                table="video_briefings",
                params={
                    "select": select_cols,
                    "id": f"eq.{args.briefing_id}",
                    "limit": "1",
                },
                service_key=service_key,
            )
        else:
            rows = _supabase_get_json_list(
                base_url=base_url,
                table="video_briefings",
                params={
                    "select": select_cols,
                    "date": f"eq.{args.date}",
                    "audience": f"eq.{args.audience}",
                    "limit": "1",
                },
                service_key=service_key,
            )

        if not rows:
            log("no matching video_briefings row found")
            return 1

        row = rows[0]
        briefing_id = str(row.get("id") or "")
        title = str(row.get("title") or "").strip()
        slug = str(row.get("slug") or "").strip()
        summary = str(row.get("summary") or "").strip()
        video_url = str(row.get("video_url") or "").strip()
        thumbnail_url = str(row.get("thumbnail_url") or "").strip()
        youtube_video_id = str(row.get("youtube_video_id") or "").strip()

        if not briefing_id or not title or not slug or not video_url:
            log("row missing required fields (id/title/slug/video_url)")
            return 1

        if youtube_video_id and not args.force:
            log(f"already uploaded (youtube_video_id={youtube_video_id}) — skipping")
            return 0

        # 2) Fetch cited articles (optional)
        article_ids_raw = row.get("article_ids")
        article_ids: list[str] = []
        if isinstance(article_ids_raw, list):
            article_ids = [str(x) for x in article_ids_raw if str(x).strip()]

        articles: list[dict[str, Any]] = []
        if article_ids:
            ids = ",".join(article_ids)
            articles = _supabase_get_json_list(
                base_url=base_url,
                table="articles",
                params={
                    "select": "id,title,url,slug",
                    "id": f"in.({ids})",
                    "limit": "200",
                },
                service_key=service_key,
            )

        # 3) Download video (+ thumbnail)
        video_path = _download(video_url, suffix=".mp4")
        temp_paths.append(video_path)

        thumbnail_path: str | None = None
        if thumbnail_url:
            thumbnail_path = _download(thumbnail_url, suffix=".jpg")
            temp_paths.append(thumbnail_path)

        # 4) Build OAuth credentials from env + refresh
        # Required env vars:
        #   YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN
        # See README.md for how to obtain these via Google Cloud Console + OAuth consent.
        client_id = _require_env("YOUTUBE_CLIENT_ID")
        client_secret = _require_env("YOUTUBE_CLIENT_SECRET")
        refresh_token = _require_env("YOUTUBE_REFRESH_TOKEN")

        # Import google deps only when we actually run uploads.
        from google.auth.transport.requests import Request  # type: ignore
        from google.oauth2.credentials import Credentials  # type: ignore
        from googleapiclient.discovery import build  # type: ignore
        from googleapiclient.errors import HttpError  # type: ignore
        from googleapiclient.http import MediaFileUpload  # type: ignore

        creds = Credentials(
            token=None,
            refresh_token=refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=client_id,
            client_secret=client_secret,
            scopes=SCOPES,
        )
        creds.refresh(Request())

        youtube = build("youtube", "v3", credentials=creds)

        # 5) Print destination channel for sanity-check (best-effort — needs read scope, token may be upload-only)
        try:
            ch = youtube.channels().list(part="snippet", mine=True, maxResults=1).execute()
            items = ch.get("items") if isinstance(ch, dict) else None
            if isinstance(items, list) and items:
                ch0 = items[0] if isinstance(items[0], dict) else {}
                ch_id = str(ch0.get("id") or "")
                ch_title = str((ch0.get("snippet") or {}).get("title") or "")
                log(f"destination channel: {ch_title} ({ch_id})")
            else:
                log("warning: could not determine destination channel")
        except HttpError as e:
            log(f"channel sanity-check skipped (tolerated — token may be upload-only): {e}")

        # 6) Upload
        yt_title = f"ThreatNoir SOC Brief: {title}".strip()
        description = _build_description(summary=summary, slug=slug, articles=articles)

        body = {
            "snippet": {
                "title": yt_title,
                "description": description,
                "tags": ["cybersecurity", "SOC", "threat intelligence", "ThreatNoir"],
                "categoryId": "28",
            },
            "status": {
                "privacyStatus": "public",
                "selfDeclaredMadeForKids": False,
            },
        }

        insert_req = youtube.videos().insert(
            part="snippet,status",
            body=body,
            media_body=MediaFileUpload(
                video_path,
                chunksize=-1,
                resumable=True,
                mimetype="video/mp4",
            ),
        )

        response: dict[str, Any] | None = None
        retry = 0
        while response is None:
            try:
                _status, response = insert_req.next_chunk()
            except HttpError as e:
                status = int(getattr(e.resp, "status", 0) or 0)
                if status == 403 and _parse_quota_exceeded(e):
                    log("quota exhausted, retry tomorrow")
                    return 2

                if status in (500, 502, 503, 504) and retry < 8:
                    retry += 1
                    sleep_s = min(60.0, (2**retry) + random.random())
                    log(f"transient HttpError {status}; retry {retry}/8 in {sleep_s:.1f}s")
                    time.sleep(sleep_s)
                    continue
                raise

        video_id = str(response.get("id") or "")
        if not video_id:
            raise RuntimeError(f"Upload succeeded but no video id in response: {response}")

        youtube_url = f"https://youtube.com/watch?v={video_id}"
        log(f"uploaded: {youtube_url}")

        # 7) Set thumbnail (best-effort)
        if thumbnail_path:
            try:
                youtube.thumbnails().set(
                    videoId=video_id,
                    media_body=MediaFileUpload(thumbnail_path),
                ).execute()
                log("thumbnail set")
            except HttpError as e:
                log(f"thumbnail set failed (tolerated): {e}")

        # 8) Add to playlist if present
        try:
            pl = youtube.playlists().list(part="snippet", mine=True, maxResults=50).execute()
            pl_items = pl.get("items") if isinstance(pl, dict) else None
            playlist_id: str | None = None
            if isinstance(pl_items, list):
                for it in pl_items:
                    if not isinstance(it, dict):
                        continue
                    sn = it.get("snippet") if isinstance(it.get("snippet"), dict) else {}
                    if str(sn.get("title") or "").strip() == "Daily SOC Brief":
                        playlist_id = str(it.get("id") or "")
                        break

            if playlist_id:
                youtube.playlistItems().insert(
                    part="snippet",
                    body={
                        "snippet": {
                            "playlistId": playlist_id,
                            "resourceId": {"kind": "youtube#video", "videoId": video_id},
                        }
                    },
                ).execute()
                log("added to playlist: Daily SOC Brief")
            else:
                log("playlist 'Daily SOC Brief' not found — skipping")
        except HttpError as e:
            log(f"playlist add failed (tolerated): {e}")

        # 9) Update DB with YouTube metadata
        now_iso = dt.datetime.now(dt.timezone.utc).isoformat()
        _supabase_patch(
            base_url=base_url,
            table="video_briefings",
            eq_id=briefing_id,
            body={
                "youtube_video_id": video_id,
                "youtube_url": youtube_url,
                "youtube_uploaded_at": now_iso,
            },
            service_key=service_key,
        )
        log("db updated")

        # 10) Optional: Discord DM notification
        # TODO(LEN-1761): mirror threatnoir-cyber-news publish_youtube.py Discord DM on success.

        return 0

    except Exception as e:
        # Exit code mapping is handled above for quota exhaustion.
        log(f"error: {e}")
        traceback.print_exc()
        return 1
    finally:
        for p in temp_paths:
            try:
                Path(p).unlink(missing_ok=True)
            except Exception:
                pass


if __name__ == "__main__":
    raise SystemExit(main())
