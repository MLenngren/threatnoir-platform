#!/usr/bin/env python3

import argparse, datetime as dt, json, os, re, sys, textwrap, time, urllib.parse, urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

# Ensure repo root is on sys.path so we can import scripts/utils when executed
# directly (e.g. `python scripts/linkedin/generate_weekly_draft.py`).
_d = os.path.abspath(os.path.dirname(__file__))
while os.path.basename(_d) != "scripts" and _d != os.path.dirname(_d):
    _d = os.path.dirname(_d)
_project_root = os.path.dirname(_d)
if _project_root and _project_root not in sys.path:
    sys.path.insert(0, _project_root)

from scripts.utils.ai_cost import log_ai_call  # noqa: E402

ANTHROPIC_MODEL = "claude-haiku-4-5-20251001"

# Marcus's LinkedIn voice pattern (content copied verbatim from weekly-linkedin-voice.md)
LINKEDIN_VOICE_PROMPT = (
    "When drafting LinkedIn posts for the weekly ThreatNoir roundup, match Marcus's actual posting style:\n\n"
    "**Why:** Marcus posted the W14 roundup manually and the voice was much better than the AI-drafted numbered list. His style got engagement because it felt like a real person sharing, not a news bulletin.\n\n"
    "**How to apply:**\n\n"
    "Structure:\n"
    "- Open with personal commentary, not a cold hook. \"I read that...\", \"Last week was...\", a question or observation\n"
    "- Flow as conversational paragraphs, NOT numbered lists\n"
    "- Each story gets its own paragraph with 1-2 sentences\n"
    "- Add parenthetical asides that show opinion: \"(it does feel like Fortinet gets hit a lot?)\", \"(rougher than usual?)\"\n"
    "- End with the punchy tagline from the card\n"
    "- Link at the bottom, standalone, not inline\n"
    "- Hashtags at the very end: #cybersecurity + 1-2 topic-specific\n\n"
    "Tone:\n"
    "- Practitioner sharing with peers, not analyst briefing executives\n"
    "- \"I read that...\" not \"This week brought...\"\n"
    "- Personal takes: \"not sure how long you would survive\" not \"organizations face significant risk\"\n"
    "- Slight provocations as questions, not statements\n"
    "- No bold, no bullet points, no numbered lists\n"
    "- No emoji\n\n"
    "Reference post (W14):\n"
    '"I read that last week was rough (rougher than usual?), if you are a business (big or small) good IT hygiene can be optional if you accept the risk, but not sure how long you would survive..."'
)


def http_json(method, url, headers, payload=None, timeout=60):
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    h = dict(headers)
    if data is not None:
        h["content-type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=h, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def supabase_headers(service_key):
    return {"apikey": service_key, "authorization": f"Bearer {service_key}"}


def fetch_latest_weekly(supabase_url, service_key, date=None):
    base = supabase_url.rstrip("/")
    p = {
        "select": "week_label,slug,tldr,full_brief,date_from,date_to,published_at,created_at",
        "status": "eq.published",
        "order": "published_at.desc.nullslast,created_at.desc",
        "limit": "1",
    }
    if date:
        p["date_from"], p["date_to"] = f"lte.{date}", f"gte.{date}"
    qs = urllib.parse.urlencode(p, safe=",.()")
    rows = http_json("GET", f"{base}/rest/v1/weekly_roundups?{qs}", supabase_headers(service_key), timeout=30)
    if not isinstance(rows, list) or not rows:
        raise RuntimeError("No published weekly_roundups found")
    return rows[0]


def fetch_focus_titles(supabase_url, service_key, limit=3):
    base = supabase_url.rstrip("/")
    now_iso = dt.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
    p = {
        "select": "title,created_at,expires_at",
        "status": "eq.active",
        "or": f"(expires_at.is.null,expires_at.gt.{now_iso})",
        "order": "created_at.desc",
        "limit": str(limit),
    }
    qs = urllib.parse.urlencode(p, safe=",.()")
    rows = http_json("GET", f"{base}/rest/v1/focus_items?{qs}", supabase_headers(service_key), timeout=30)
    return [
        r["title"].strip()
        for r in (rows or [])
        if isinstance(r, dict) and isinstance(r.get("title"), str) and r["title"].strip()
    ][:limit]


def extract_story_summaries(full_brief, limit=6):
    out = []
    for line in (full_brief or "").splitlines():
        m = re.search(r"\*\*\[([^\]]+)\]\(([^)]+)\)\*\*\.\s*(.+)$", line.strip())
        if m:
            out.append(f"{m.group(1).strip()}: {m.group(3).strip()[:220]}")
        if len(out) >= limit:
            break
    return out


def extract_tagline(post_text):
    lines = [l.rstrip() for l in (post_text or "").splitlines()]
    for i, l in enumerate(lines):
        if l.strip().startswith("https://threatnoir.com/weekly/"):
            for j in range(i - 1, -1, -1):
                if lines[j].strip():
                    return lines[j].strip()
    for l in reversed(lines):
        s = l.strip()
        if s and not s.startswith("#") and not s.startswith("http"):
            return s
    return "ThreatNoir — practitioner-grade threat intel with the noise removed."


def font(size, bold=False):
    c = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ]
    for p in c:
        try:
            return ImageFont.truetype(p, size)
        except Exception:
            pass
    return ImageFont.load_default()


def render_card(path, week_label, tagline):
    w, h, pad = 1200, 630, 60
    img = Image.new("RGB", (w, h), "#0e131f")
    d = ImageDraw.Draw(img)

    lf, wf = font(22, True), font(20, False)
    x = pad
    for ch in "THREATNOIR":
        d.text((x, 44), ch, font=lf, fill="#4cd7f6")
        x += d.textlength(ch, font=lf) + 2
    week = (week_label or "").strip()[:40]
    if week:
        d.text((w - pad - d.textlength(week, font=wf), 46), week, font=wf, fill="#64748b")

    body = (tagline or "").strip()
    size = 48
    while size >= 36:
        bf = font(size, True)
        wrapped = "\n".join(textwrap.wrap(body, width=40))
        box = d.multiline_textbbox((0, 0), wrapped, font=bf, spacing=10, align="center")
        if (box[2] - box[0]) <= (w - pad * 2) and (box[3] - box[1]) <= 360:
            break
        size -= 2
    bf = font(size, True)
    wrapped = "\n".join(textwrap.wrap(body, width=40))
    box = d.multiline_textbbox((0, 0), wrapped, font=bf, spacing=10, align="center")
    bw, bh = box[2] - box[0], box[3] - box[1]
    d.multiline_text(((w - bw) / 2, (h - bh) / 2), wrapped, font=bf, fill="#ffffff", spacing=10, align="center")

    ff = font(18, False)
    footer = "threatnoir.com"
    d.text(((w - d.textlength(footer, font=ff)) / 2, h - 56), footer, font=ff, fill="#64748b")
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    img.save(path, format="PNG")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--output-dir", default="/tmp/linkedin-draft")
    ap.add_argument("--date", default=None, help="YYYY-MM-DD")
    a = ap.parse_args()

    supabase_url = (os.getenv("SUPABASE_URL") or "").strip()
    service_key = (os.getenv("SUPABASE_SERVICE_KEY") or "").strip()
    api_key = (os.getenv("ANTHROPIC_API_KEY") or "").strip()
    if not (supabase_url and service_key and api_key):
        raise SystemExit("Missing env: SUPABASE_URL, SUPABASE_SERVICE_KEY, ANTHROPIC_API_KEY")

    weekly = fetch_latest_weekly(supabase_url, service_key, a.date)
    focus = fetch_focus_titles(supabase_url, service_key, 3)
    week_label = str(weekly.get("week_label") or "").strip()
    slug = str(weekly.get("slug") or "").strip()
    tldr = str(weekly.get("tldr") or "").strip()
    full_brief = str(weekly.get("full_brief") or "").strip()
    stories = extract_story_summaries(full_brief, 6)

    user_prompt = (
        "Write a LinkedIn post about this week's ThreatNoir roundup.\n\n"
        f"Week: {week_label}\n\nTLDR:\n{tldr}\n\n"
        + "Top stories (summaries):\n"
        + "\n".join(f"- {s}" for s in (stories or ["(none)"]))
        + "\n\nActive focus items:\n"
        + "\n".join(f"- {t}" for t in (focus or ["(none)"]))
        + "\n\n"
        + "Formatting rules: conversational paragraphs (no lists/bold/emoji). Each story gets its own paragraph (1-2 sentences). Use occasional parenthetical asides.\n"
        + "End with a punchy standalone tagline line, then a blank line, then the link on its own line, then hashtags at the end.\n"
        + f"Use this exact link (standalone): https://threatnoir.com/weekly/{slug}\n"
        + "Hashtags: #cybersecurity plus 1-2 relevant hashtags."
    )

    started = time.time()
    resp = http_json(
        "POST",
        "https://api.anthropic.com/v1/messages",
        {"x-api-key": api_key, "anthropic-version": "2023-06-01"},
        {
            "model": ANTHROPIC_MODEL,
            "max_tokens": 1000,
            "temperature": 0.8,
            "system": LINKEDIN_VOICE_PROMPT,
            "messages": [{"role": "user", "content": user_prompt}],
        },
        timeout=90,
    )
    duration_ms = int((time.time() - started) * 1000)
    log_ai_call(
        pipeline="linkedin_draft_weekly_py",
        model=ANTHROPIC_MODEL,
        response=resp,
        duration_ms=duration_ms,
        metadata={
            "week_label": week_label,
            "slug": slug,
            "date": a.date,
            "stories_in": len(stories or []),
            "focus_in": len(focus or []),
        },
    )
    post = "\n".join(
        c.get("text", "")
        for c in (resp.get("content") if isinstance(resp, dict) else [])
        if isinstance(c, dict) and c.get("type") == "text"
    ).strip()
    tag = extract_tagline(post)

    out = Path(a.output_dir)
    out.mkdir(parents=True, exist_ok=True)
    (out / "post.txt").write_text(post.strip() + "\n", encoding="utf-8")
    render_card(out / "card.png", week_label, tag)
    sys.stdout.write(post.strip() + "\n")


if __name__ == "__main__":
    main()