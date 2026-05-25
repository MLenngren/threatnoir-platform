#!/usr/bin/env python3
"""ThreatNoir daily video briefing orchestrator.

Chains: fetch articles → route audiences → generate scripts → generate frames
→ render via Remotion → upload to R2 → record in DB → notify Discord.

Usage:
    python scripts/video/generate.py                    # yesterday's articles
    python scripts/video/generate.py --date 2026-03-14  # specific date
    python scripts/video/generate.py --dry-run           # preview without rendering/uploading
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import traceback
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent
VIDEO_DIR = PROJECT_ROOT / "video"
OUTPUT_DIR = PROJECT_ROOT / "output"

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

SUPABASE_REF = (os.environ.get("SUPABASE_URL") or "").replace("https://", "").replace("http://", "").split(".")[0]
if not SUPABASE_REF:
    raise SystemExit("SUPABASE_URL env var required (e.g. https://abcdefgh.supabase.co)")
DEFAULT_SUPABASE_URL = f"https://{SUPABASE_REF}.supabase.co"
R2_PUBLIC_BASE = "https://cdn.threatnoir.com"
R2_BUCKET = "threatnoir-videos"
AUDIENCES = ("executive", "soc", "engineer")
MIN_ARTICLES_PER_AUDIENCE = 3


@dataclass
class RunStats:
    """Track costs and results across the pipeline."""
    videos_generated: int = 0
    videos_failed: int = 0
    total_cost_usd: float = 0.0
    results: list[dict[str, Any]] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


def eprint(*args: object) -> None:
    print(*args, file=sys.stderr)


def _parse_date(value: str | None) -> date:
    if value in (None, "", "yesterday"):
        return datetime.now(timezone.utc).date() - timedelta(days=1)
    return date.fromisoformat(value)


# ---------------------------------------------------------------------------
# Step 1: Fetch articles + route to audiences
# ---------------------------------------------------------------------------

def fetch_and_route(target_date: date) -> dict[str, list[dict[str, Any]]]:
    """Fetch approved articles and route to audience buckets."""
    from fetch_articles import fetch_articles_with_metadata, route_by_audience

    base_url = os.environ.get("SUPABASE_URL", DEFAULT_SUPABASE_URL).rstrip("/")
    service_key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not service_key:
        raise RuntimeError("SUPABASE_SERVICE_KEY env var required")

    articles = fetch_articles_with_metadata(
        base_url=base_url,
        service_key=service_key,
        target_date=target_date,
    )
    eprint(f"[orchestrator] fetched {len(articles)} approved articles for {target_date}")

    routed = route_by_audience(articles)
    for aud, arts in routed.items():
        eprint(f"[orchestrator]   {aud}: {len(arts)} articles")

    return routed


# ---------------------------------------------------------------------------
# Step 2: Generate narration script via Claude
# ---------------------------------------------------------------------------

def gen_script(audience: str, articles: list[dict[str, Any]], date_str: str) -> dict[str, Any]:
    """Generate video script JSON for one audience."""
    from generate_script import generate_script, usage_to_cost_usd

    script, usage = generate_script(
        audience=audience,
        date_str=date_str,
        articles=articles,
    )
    cost = usage_to_cost_usd(usage)
    eprint(f"[orchestrator] script for {audience}: {len(script.get('segments', []))} segments, cost=${cost:.4f}")
    return script


# ---------------------------------------------------------------------------
# Step 3: Generate background frames via Gemini
# ---------------------------------------------------------------------------

def gen_frames(script: dict[str, Any], frames_dir: str) -> list[str]:
    """Generate background images for each segment."""
    from generate_frames import generate_frames

    frames = generate_frames(script, frames_dir)
    eprint(f"[orchestrator] generated {len(frames)} frames in {frames_dir}")
    return frames


# ---------------------------------------------------------------------------
# Step 4: Write Remotion props JSON
# ---------------------------------------------------------------------------

def write_props(
    script: dict[str, Any],
    frames: list[str],
    props_path: str,
    articles: list[dict[str, Any]] | None = None,
) -> str:
    """Write Remotion-compatible props JSON, mapping frame paths to staticFile refs."""
    props = dict(script)

    # Build article_id → categories lookup
    cats_by_id: dict[str, list[str]] = {}
    if articles:
        for a in articles:
            aid = str(a.get("id", ""))
            if aid:
                cats_by_id[aid] = a.get("categories", [])

    # Map absolute frame paths to Remotion staticFile references.
    # Frames are in video/public/frames/... — Remotion serves from video/public/
    video_public = str(VIDEO_DIR / "public")
    for i, seg in enumerate(props.get("segments", [])):
        # Enrich with categories from source article
        src_id = seg.get("source_article_id", "")
        if src_id and src_id in cats_by_id:
            seg["categories"] = cats_by_id[src_id]

        if i < len(frames):
            frame_path = frames[i]
            # Convert absolute path to relative from video/public/
            if frame_path.startswith(video_public):
                rel = frame_path[len(video_public):].lstrip("/")
            else:
                rel = os.path.basename(frame_path)
            seg["background_image"] = rel

    os.makedirs(os.path.dirname(props_path), exist_ok=True)
    with open(props_path, "w", encoding="utf-8") as f:
        json.dump(props, f, ensure_ascii=False, indent=2)

    eprint(f"[orchestrator] wrote props to {props_path}")
    return props_path


# ---------------------------------------------------------------------------
# Step 5: Render video via Remotion CLI
# ---------------------------------------------------------------------------

def render_video(props_path: str, output_path: str) -> str:
    """Render MP4 using Remotion CLI."""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    cmd = [
        "npx", "remotion", "render",
        "BriefingComposition",
        f"--props={os.path.abspath(props_path)}",
        f"--output={os.path.abspath(output_path)}",
        "--codec=h264",
        "--log=error",
    ]
    eprint(f"[orchestrator] rendering video: {' '.join(cmd[:4])}...")
    result = subprocess.run(
        cmd,
        cwd=str(VIDEO_DIR),
        capture_output=True,
        text=True,
        timeout=300,
    )
    if result.returncode != 0:
        eprint(f"[orchestrator] Remotion stderr: {result.stderr[:1000]}")
        raise RuntimeError(f"Remotion render failed (exit {result.returncode})")

    eprint(f"[orchestrator] rendered: {output_path}")
    return output_path


# ---------------------------------------------------------------------------
# Step 6: Upload to Cloudflare R2
# ---------------------------------------------------------------------------

def _get_r2_client() -> Any:
    """Create boto3 S3 client configured for Cloudflare R2."""
    import boto3

    # Load credentials — try env first, then 1Password fields
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


def upload_to_r2(local_path: str, r2_key: str, content_type: str = "video/mp4") -> str:
    """Upload a file to R2 and return the public URL."""
    client = _get_r2_client()
    client.upload_file(
        local_path,
        R2_BUCKET,
        r2_key,
        ExtraArgs={"ContentType": content_type},
    )
    url = f"{R2_PUBLIC_BASE}/{r2_key}"
    eprint(f"[orchestrator] uploaded to R2: {url}")
    return url


# ---------------------------------------------------------------------------
# Step 7: Record in Supabase
# ---------------------------------------------------------------------------

def record_briefing(
    *,
    date_str: str,
    audience: str,
    script: dict[str, Any],
    video_url: str,
    thumbnail_url: str | None,
    article_count: int,
    article_ids: list[str],
    cost_cents: float,
    duration_seconds: int | None,
) -> None:
    """Insert or upsert a record into the video_briefings table."""
    import httpx

    base_url = os.environ.get("SUPABASE_URL", DEFAULT_SUPABASE_URL).rstrip("/")
    service_key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not service_key:
        raise RuntimeError("SUPABASE_SERVICE_KEY required for DB recording")

    row = {
        "date": date_str,
        "audience": audience,
        "title": script.get("title", f"ThreatNoir Briefing — {audience}"),
        "duration_seconds": duration_seconds,
        "video_url": video_url,
        "thumbnail_url": thumbnail_url,
        "article_count": article_count,
        "article_ids": article_ids,
        "script": script,
        "cost_cents": round(cost_cents, 2),
    }

    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }

    resp = httpx.post(
        f"{base_url}/rest/v1/video_briefings",
        headers=headers,
        json=row,
        timeout=30.0,
    )
    if resp.status_code >= 400:
        eprint(f"[orchestrator] DB insert warning: {resp.status_code} {resp.text[:300]}")
    else:
        eprint(f"[orchestrator] recorded briefing: {audience} {date_str}")


# ---------------------------------------------------------------------------
# Step 8: Discord notification
# ---------------------------------------------------------------------------

def send_discord_notification(date_str: str, results: list[dict[str, Any]], errors: list[str]) -> None:
    """Send completion/failure notification to Discord."""
    try:
        from pathlib import Path as P
        add_reminder_script = P.home() / "projects" / "discord-odin" / "send_dm.py"

        if not add_reminder_script.exists():
            # Fallback: try webhook
            webhook_url = os.environ.get("DISCORD_WEBHOOK_URL")
            if webhook_url:
                _send_webhook(webhook_url, date_str, results, errors)
            else:
                eprint("[orchestrator] no Discord notification method available")
            return

        lines = [f"**ThreatNoir Video Briefings — {date_str}**\n"]
        for r in results:
            lines.append(f"✅ {r['audience'].title()}: {r['article_count']} articles → {r['video_url']}")
        for e in errors:
            lines.append(f"❌ {e}")
        if not results and not errors:
            lines.append("⏭️ Skipped — insufficient articles for all audiences")

        message = "\n".join(lines)
        subprocess.run(
            [
                str(P.home() / "projects" / "discord-odin" / "venv" / "bin" / "python"),
                str(add_reminder_script),
                "--message", message,
            ],
            timeout=30,
            capture_output=True,
        )
        eprint(f"[orchestrator] Discord notification sent")
    except Exception as exc:
        eprint(f"[orchestrator] Discord notification failed: {exc}")


def _send_webhook(webhook_url: str, date_str: str, results: list[dict[str, Any]], errors: list[str]) -> None:
    """Fallback: send via Discord webhook."""
    import httpx

    lines = [f"**ThreatNoir Video Briefings — {date_str}**"]
    for r in results:
        lines.append(f"✅ {r['audience'].title()}: {r['article_count']} articles")
    for e in errors:
        lines.append(f"❌ {e}")

    httpx.post(
        webhook_url,
        json={"content": "\n".join(lines)},
        timeout=10.0,
    )


# ---------------------------------------------------------------------------
# Main orchestrator
# ---------------------------------------------------------------------------

def generate_daily_briefings(target_date: date, *, dry_run: bool = False) -> RunStats:
    """Run the full pipeline for all audiences."""
    date_str = target_date.isoformat()
    stats = RunStats()

    # Step 1: Fetch and route
    eprint(f"\n{'='*60}")
    eprint(f"[orchestrator] Starting video briefing generation for {date_str}")
    eprint(f"{'='*60}\n")

    routed = fetch_and_route(target_date)

    if not routed:
        eprint(f"[orchestrator] No audiences have enough articles. Skipping.")
        return stats

    for audience, articles in routed.items():
        eprint(f"\n{'─'*40}")
        eprint(f"[orchestrator] Processing: {audience} ({len(articles)} articles)")
        eprint(f"{'─'*40}")

        try:
            # Step 2: Generate script
            script = gen_script(audience, articles, date_str)
            script_cost = 0.01  # ~$0.01 per Haiku call

            # Step 3: Generate background frames
            frames_dir = str(VIDEO_DIR / "public" / "frames" / date_str / audience)
            if dry_run:
                eprint(f"[orchestrator] DRY RUN: would generate frames in {frames_dir}")
                frames = []
            else:
                frames = gen_frames(script, frames_dir)
            frame_cost = len(frames) * 0.013

            # Step 4: Write Remotion props
            props_dir = str(OUTPUT_DIR / date_str)
            props_path = os.path.join(props_dir, f"{audience}_props.json")
            write_props(script, frames, props_path, articles=articles)

            if dry_run:
                eprint(f"[orchestrator] DRY RUN: would render and upload. Props at {props_path}")
                stats.videos_generated += 1
                stats.total_cost_usd += script_cost
                stats.results.append({
                    "audience": audience,
                    "article_count": len(articles),
                    "video_url": "(dry run)",
                })
                continue

            # Step 5: Render video
            video_path = os.path.join(str(OUTPUT_DIR / date_str), f"{audience}.mp4")
            render_video(props_path, video_path)

            # Step 6: Upload to R2
            video_url = upload_to_r2(
                video_path,
                f"videos/{date_str}/{audience}.mp4",
                content_type="video/mp4",
            )
            thumbnail_url = None
            if frames:
                thumbnail_url = upload_to_r2(
                    frames[0],
                    f"thumbnails/{date_str}/{audience}.png",
                    content_type="image/png",
                )

            # Step 7: Record in DB
            article_ids = [str(a.get("id", "")) for a in articles if a.get("id")]
            total_cost_cents = (script_cost + frame_cost) * 100
            duration = script.get("estimated_duration_seconds")

            record_briefing(
                date_str=date_str,
                audience=audience,
                script=script,
                video_url=video_url,
                thumbnail_url=thumbnail_url,
                article_count=len(articles),
                article_ids=article_ids,
                cost_cents=total_cost_cents,
                duration_seconds=duration,
            )

            stats.videos_generated += 1
            stats.total_cost_usd += script_cost + frame_cost
            stats.results.append({
                "audience": audience,
                "article_count": len(articles),
                "video_url": video_url,
            })

        except Exception as exc:
            stats.videos_failed += 1
            error_msg = f"{audience}: {exc}"
            stats.errors.append(error_msg)
            eprint(f"[orchestrator] ERROR for {audience}:")
            traceback.print_exc(file=sys.stderr)
            # Continue to next audience

    # Step 8: Notify
    eprint(f"\n{'='*60}")
    eprint(f"[orchestrator] Pipeline complete: {stats.videos_generated} generated, {stats.videos_failed} failed")
    eprint(f"[orchestrator] Total cost: ${stats.total_cost_usd:.3f}")
    eprint(f"{'='*60}")

    if not dry_run:
        send_discord_notification(date_str, stats.results, stats.errors)

    return stats


def main() -> int:
    parser = argparse.ArgumentParser(description="ThreatNoir daily video briefing orchestrator")
    parser.add_argument(
        "--date",
        default="yesterday",
        help="Target date (YYYY-MM-DD or 'yesterday', default: yesterday)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Generate scripts and props only — skip rendering, uploading, and notifications",
    )
    args = parser.parse_args()

    target = _parse_date(args.date)
    stats = generate_daily_briefings(target, dry_run=args.dry_run)

    if stats.videos_failed > 0 and stats.videos_generated == 0:
        return 1
    return 0


if __name__ == "__main__":
    # Add scripts/video to sys.path so we can import sibling modules
    sys.path.insert(0, str(SCRIPT_DIR))
    raise SystemExit(main())
