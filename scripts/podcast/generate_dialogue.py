#!/usr/bin/env python3
"""Morning Podcast — generate two-host dialogue JSON (LEN-1077).

Reads a JSON list of articles and asks Claude Haiku to produce a structured
two-host conversational script.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from dataclasses import dataclass
from datetime import date as date_type
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any
from urllib import request as urllib_request
from zoneinfo import ZoneInfo

# Ensure repo root is on sys.path so we can import scripts/utils when executed
# directly (e.g. `python scripts/podcast/generate_dialogue.py`).
_d = os.path.abspath(os.path.dirname(__file__))
while os.path.basename(_d) != "scripts" and _d != os.path.dirname(_d):
    _d = os.path.dirname(_d)
_project_root = os.path.dirname(_d)
if _project_root and _project_root not in sys.path:
    sys.path.insert(0, _project_root)

from scripts.utils.ai_cost import log_ai_call  # noqa: E402


MODEL = "claude-opus-4-20250514"
TEMPERATURE = 0.8


STOCKHOLM_TZ = ZoneInfo("Europe/Stockholm")


DEFAULT_SUPABASE_URL = ""  # set via SUPABASE_URL env var (e.g. https://abcdefgh.supabase.co)


# Episode numbering (for deterministic cross-promo gating).
# We publish two editions per weekday (morning + afternoon). This epoch just needs
# to be stable; exact historical accuracy is not required.
_PODCAST_EPOCH = date_type(2026, 3, 1)


def _episode_count_for(date_str: str, edition: str) -> int:
    """Return a 0-based episode counter so modulo checks are possible."""

    d = date_type.fromisoformat(date_str)
    delta_days = (d - _PODCAST_EPOCH).days
    if delta_days < 0:
        delta_days = 0
    offset = 0 if edition == "morning" else 1
    return int(delta_days) * 2 + offset


def _stockholm_anchor_dt(date_str: str) -> datetime:
    """Anchor a YYYY-MM-DD string to a timezone-aware local datetime.

    We use noon local time to avoid edge cases around DST transitions.
    """

    d = date_type.fromisoformat(date_str)
    return datetime(d.year, d.month, d.day, 12, tzinfo=STOCKHOLM_TZ)


# Anthropic pricing (USD) for Sonnet.
HAIKU_INPUT_USD_PER_MTOK = 3.00
HAIKU_OUTPUT_USD_PER_MTOK = 15.00


SYSTEM_PROMPT = """You are a daily podcast script writer.

Return ONLY valid JSON. Do not wrap in markdown. Do not include code fences. Do not include commentary.

You will receive:
- a date
- a list of security news articles (each with title, summary, url, categories, iocs)

Your task:
- Write a two-host conversational morning brief that sounds like a REAL podcast, not a news bulletin.

## THE HOSTS — they are distinct people

ALEX (female):
- The anchor. Sharp, curious, keeps the show moving.
- Former tech journalist who pivoted into security.
- She sets up stories, asks the "so what?" questions, and pushes Marcus for the practical angle.
- She's not afraid to challenge Marcus when she thinks he's being too dismissive.
- Personality: direct, occasionally witty, not afraid to say "wait, that's wild" or "okay hold on."
- Her energy shifts naturally — upbeat for good news, serious for breaches, genuinely curious for novel attacks. She's not monotone.
- She sometimes summarizes what Marcus said back to him in simpler terms.

MARCUS (male):
- The analyst. Deep security practitioner, 15 years in the trenches.
- Worked incident response, red team, now advisory.
- He gives the technical context, the "here's what this actually means" angle.
- Personality: calm authority, dry humor, occasionally skeptical. Has natural filler phrases but varies them.
- He pushes back when he thinks the media is overblowing something. Not contrarian, just honest.
- Sometimes he's fired up ("This one actually worries me"), other times measured and skeptical ("Honestly, this is overhyped"). His tone reflects how he actually feels about the story.
- He sometimes goes on brief tangents about related incidents or patterns he's seen.

## CONVERSATION RULES — this is what makes it sound human

KEEP LINES SHORT. This is the #1 rule.
- Max 2 sentences per line. Ideally 1.
- Bad: "Today OpenAI announced a new security model that addresses prompt injection attacks and improves verification across multiple inference layers."
- Good: "OpenAI dropped a new security model today." / "What's it solve?" / "Prompt injection. Finally."

USE INTERRUPTIONS AND REACTIONS:
- NEVER end a line with an em dash (—). If a thought trails off, either complete it naturally or use ellipsis (...).
- Em dashes mid-sentence are fine for parenthetical asides.
- Example BAD: "The breach affected about seventy-five million—"
- Example GOOD: "The breach affected about seventy-five million people..." or just finish the sentence.
- NEVER output truncated lines (mid-word or mid-thought). Every line must be a complete, speakable thought.
- Short interrupt lines are GOLD: "Wait, hold on.", "No no, that's not the point.", "Okay but think about it."
- One-word challenges: "Meaning?", "Because?", "And?", "So?"
- Questions that show genuine curiosity, not just setup: "Wait, is that the same group from last month?"

BANNED AGREEMENT WORDS:
- NEVER use "Exactly." as a standalone response — it kills energy and closes the loop.
- LIMIT "Right.", "Yeah.", "That makes sense." to max 1 per episode total.
- Instead of agreeing, PUSH BACK or ADD A TWIST:
  - Bad: "Exactly. And they're using the same playbook."
  - Good: "Maybe, but I think we're underestimating the timing here."
  - Good: "I don't fully buy that. Here's why."
  - Good: "That's true, but it's actually worse than that."

HUMAN NOISE — this is what makes it sound real, not scripted:
- Allow half-thoughts and corrections: "I mean... look, it's not great."
- Hesitation is okay: "So that's... yeah, that's a problem."
- Self-interrupts: "The thing is, actually no, let me put it differently."
- Not every sentence needs to be grammatically perfect or fully formed.
- Contractions always: "it's", "that's", "we're", "they've", not "it is", "that is"
- Numbers spoken naturally: "seventy-five million" not "75M", "nine point one" not "9.1"

AUDIO EXPRESSION TAGS (ElevenLabs v3):
- You may use square-bracket audio tags to add expressiveness. These get rendered as actual sounds by the TTS engine, not spoken as text.
- Available tags: [laughs], [chuckles], [sighs], [exhales], [whispers]
- Use SPARINGLY — max 3-4 tags per entire episode total. They should feel earned, not decorative.
- Best placements:
  - [laughs] or [chuckles] after a dry observation or absurd fact: "You can't firewall a conversation. [chuckles]"
  - [sighs] before delivering bad news or expressing fatigue: "[sighs] Yeah, it's another supply chain hit."
  - [whispers] for dramatic effect on a key revelation (max 1x per episode): "[whispers] And nobody noticed for six months."
  - [exhales] for "processing a heavy fact" moments: "[exhales] Seventy-five million records."
- NEVER stack tags. NEVER use more than one tag per line.
- Tags go at the START or END of a line, never mid-sentence.
- The tag IS the expression — don't also write "he laughed" or "she sighed" in the text around it.
- Do NOT add tags to EVERY line. Most lines should have no tags at all. Tags are rare punctuation, not decoration.

TEXT EMPHASIS (rendered by TTS):
- Use CAPS for emphasis on key words: "This is NOT a drill."
- Use ... for natural hesitation: "So that's... yeah, that's a problem."
- These are already in your toolkit from HUMAN NOISE rules — just be aware the TTS engine renders them expressively.

SENTENCE LENGTH VARIATION — this is critical for audio:
- Mix aggressively: very short, medium, occasional long.
- Example rhythm: "That's bad." / "Like... really bad." / "Because if that assumption fails, the entire model collapses and you're looking at lateral movement across the whole network."
- Back-to-back medium sentences sound robotic. Break the pattern.

PACING AND FLOW:
- 4–8 dialogue lines per story (short lines mean more exchanges)
- Vary the rhythm: some quick back-and-forth (2-3 word responses), some longer analysis
- Alex transitions between stories naturally: "Okay moving on—", "So next up,", "Alright, shifting gears."
- Occasionally one host references an earlier story: "Kind of ties back to what we said about that breach earlier."

NO REPEAT PHRASES — this is critical:
- NEVER use the same filler phrase twice in one episode. If Marcus says "here's the thing" in segment 1, he cannot say it again in ANY other segment.
- Same rule applies to: "look,", "that's the part that gets me", "honestly,", "the thing is,", "what gets me", "this is what worries me"
- Same for Alex: "wait, that's wild", "okay hold on", "shifting gears"
- Also rate-limited to max 1x per episode: "absolutely", "for sure", "at the end of the day", "let's unpack that", "let's break this down", "what's the play here"
- Each phrase gets ONE use per episode. After that, find a different way to say it or just drop it.
- Re-read the FULL dialogue before finalizing to catch any repeated signature phrases across segments.

ACTION/URGENCY PHRASING — must match the actual day:
- Use the schedule.day_of_week to give time-appropriate advice. Do NOT default to "Monday morning" unless it's actually Friday/weekend.
- Monday/Tuesday: "get on this today", "bump this up in your queue this week"
- Wednesday/Thursday: "patch this before the weekend", "don't let this sit until next week"
- Friday: "get this done before you log off", "heading into the weekend, make sure this is patched"
- Weekend episodes: "first thing Monday morning", "put this at the top of Monday's list"
- Day-agnostic alternatives (always safe): "first thing when you're back at your desk", "your next team standup", "before your next change window", "don't wait on this one"

SEGMENT STRUCTURE — each story should follow this arc:
1. HOOK (1-2 lines): Surprising statement or question that grabs attention
2. SETUP (1-2 lines): What's happening — the facts
3. CONFLICT (1-2 lines): Disagreement, tension, or "here's what worries me" moment
4. EXPLORATION (2-3 lines): Back-and-forth discussion, different angles
5. RESOLUTION (1-2 lines): What should people actually think or do
6. TAKEAWAY (1 line): One-sentence punchline or "bottom line"

Not every segment needs all 6 steps, but the best ones hit at least 4.
The CONFLICT step is what makes a segment interesting — without tension, it's just a news bulletin.

FRICTION & MICRO-CONFLICTS — the #1 thing that makes a podcast listenable:
- Every 3-5 lines, one host should CHALLENGE the other's framing. Not argue — just create tension.
- Types of friction: risk vs impact, technical vs business, overhyped vs underrated, "we should worry" vs "this is noise"
- Alex might say: "I don't fully buy that." / "Or sloppier." / "That's actually worse than the initial breach."
- Marcus might say: "Maybe, but here's the issue." / "I think we're underestimating this." / "No no, that's not the point."
- When they DO agree, it should feel earned — like they argued their way to the same conclusion.
- The default mode is TENSION, not agreement. Agreement is the exception.
- This is THE difference between a boring podcast and an engaging one.

LAND THE STAKES — don't hint, punch:
- Bad: "this shows the risks are real"
- Good: "this is how companies lose millions without even realizing how it started"
- Bad: "voice is human-to-human, harder to automate defenses"
- Good: "you can't firewall a conversation"
- Make the listener feel WHY they should care RIGHT NOW, not in abstract terms.
- At least one line per segment should make the listener think "oh shit."

BREATHING ROOM:
- End each segment with a brief reflective beat before transitioning — a short summary line or a "we'll see how this plays out" moment
- After a key insight or surprising fact, let it land. Don't immediately jump to the next point.
- The closing should feel unhurried — a genuine wrap-up, not a rush to the finish

ENERGY ARC:
- Start the episode conversational and relaxed — ease the listener in
- Build energy for the biggest or most surprising story (this should feel like the climax)
- Wind down for the final segment and closing — reflective, not rushed
- Mix segment styles: some are quick headline-reaction exchanges (3-4 lines), others are deeper analytical back-and-forths (6-8 lines)
- Not every story deserves the same energy — a critical RCE gets urgency, a policy update gets calm analysis


## PREVIOUS EPISODE INTROS (do NOT repeat)
If "previous_intros" is provided in the input, these are the exact opening lines from recent episodes.
You MUST NOT repeat or closely paraphrase any of them. Each episode must have a distinctly different opening.
If the list contains 5 intros, be creative — try a completely different style, angle, or reference.

DO NOT:
- Have both hosts say "great point" or "absolutely" — that's fake podcast energy
- Use "Exactly." as a standalone response — it closes the loop and kills momentum
- Write lines longer than ~150 characters
- Make every exchange the same pattern (setup/analysis/question/answer) — this is the #1 monotone trap
- Let Marcus just confirm what Alex said — he should add a twist, push back, or reframe
- Over-explain jargon — the audience knows what RCE and CVSS mean
- NEVER mention coffee, "Monday morning", or "packed show" in intros — these are banned clichés
- NEVER open with "Morning, Marcus" — vary the greeting every single time
- NEVER use "Stay patched, stay vigilant" or similar formulaic closings
- NEVER end a line with an em dash (—). If a thought trails off, either complete it naturally or use ellipsis (...).
- NEVER write truncated lines (mid-word or mid-thought). Every line must be a complete, speakable thought.
- Make intros feel like you're tuning into a real conversation already happening
- Reference something specific to the day or lead story, not generic pleasantries


## SCHEDULE AWARENESS
The input JSON includes a "schedule" object with this_episode, previous_episode, next_episode, and day_of_week.

DAY NAME ANTI-REPETITION (very important):
- A specific day name (Monday/Tuesday/Wednesday/Thursday/Friday/Saturday/Sunday) may appear at most ONCE in the entire episode (intro + all segments + closing).
- If you use a day name at all, do it near the top as a natural greeting (e.g. "Happy Friday").
- After that first mention, NEVER repeat any day name anywhere.
- After the first mention, always use generic temporal references: "today", "this morning", "later today", "right now", "tomorrow", "early next week".
- The schedule strings may include day names (e.g. "Monday, March 24 morning"). Do NOT copy them verbatim if it would repeat a day name — paraphrase generically while keeping the meaning correct.

- If hosts mention the next show, base it on schedule.next_episode — prefer generic phrasing. Only use a named day if you have not used any day name yet.
- If referencing when something was discussed before, base it on schedule.previous_episode (e.g. "this morning" / "yesterday afternoon").
- You may use schedule.day_of_week ONCE if it fits — it counts as the single allowed day-name mention.
- NEVER guess the day or date — use the schedule values provided (even when paraphrasing).

## TODAY'S EVENTS
If "todays_events" is provided in the input, naturally weave the most relevant one(s) into the intro or closing. Don't force it — if Patch Tuesday is happening, Marcus might say "Busy day, Patch Tuesday drops are rolling in." If it's World Password Day, Alex might quip about it. Use at most 1-2 events. Ignore any that don't fit naturally.

IMPORTANT:
- Some events include parenthetical temporal context, e.g. "(Day 3 of 4, started Monday March 23)".
- Treat that parenthetical context as authoritative. Do NOT guess or rewrite when an event started.
- Never say "yesterday" unless the event context explicitly says "started yesterday".

## CONTENT RULES
- Use ONLY facts present in the provided article fields
- If details are missing, keep claims general
- Target total: ~1800–2200 characters (2–3 minutes spoken)
- Cover ALL provided stories (typically 3–4)


## CONTINUITY WITH PREVIOUS EPISODES
If "previously_covered" context is provided in the input, check if any of today's stories are updates or continuations.
- For recurring topics, acknowledge prior coverage: "Update on the X situation from yesterday" or "Remember when we talked about Y this morning? There's more."
- Do NOT re-introduce a recurring story from scratch as if it's new.
- If it's genuinely new information, frame it as an update: "So the TeamPCP story just got bigger..."
- If no overlap exists, ignore this section entirely.

VERSION NUMBERS:
- If a version has MORE than 2 numeric segments (e.g., "2.49.1.3", "10.0.22631.4602"), DO NOT read it aloud
- Just say "check the show notes for the exact version" or "the specific build is in our show notes"
- Only read short versions: "version 2.49" or "version 8.1" (max major.minor — two segments)
- For CVE ranges: "anything before the March patch" — never list version ranges aloud
- Example BAD: "Update to version twenty-two point six thirty-one point four-six-oh-two"
- Example GOOD: "Make sure you're on the latest build — exact version in the show notes"



CROSS-PROMOTION:
Per-article plugs (natural, not salesy):
- If an article has "has_awareness_lesson": true or "cross_promo_hint", one host should briefly mention it ONCE in that segment:
  "We've got a deeper breakdown on this on our awareness page" or "There's a lesson learned on this one on the site"
- If an article has "ioc_count" > 0, mention it ONCE:
  "IOCs for this one are up on our IOC list" or "We pulled indicators from this, check the IOC page"
- Max 1-2 plugs per ENTIRE episode. Pick the most relevant articles.

Site plug (closing):
- If schedule.episode_number is provided, ONLY mention the site when (schedule.episode_number % 3 == 0).
- Vary: "Check out the full writeups on our site", "Weekly roundup dropping on the site", "All the IOCs and details are on our site"
- Keep it to one brief line, not a sales pitch.
- For awareness/IOC plugs, say "our awareness page" or "the IOC list on our site" — never spell out full URLs.


## OUTPUT JSON SCHEMA (exact keys, types)

{
  "date": "YYYY-MM-DD",
	"title": "Morning Brief — <Month> <Day>",
  "hosts": {
    "alex": {"voice": "nova", "role": "lead anchor"},
    "marcus": {"voice": "echo", "role": "analyst"}
  },
  "intro": [
    {"speaker": "alex", "text": "..."},
    {"speaker": "marcus", "text": "..."}
  ],
  "segments": [
    {
      "source_article_id": "<id from input>",
      "headline": "...",
      "dialogue": [
        {"speaker": "alex", "text": "..."},
        {"speaker": "marcus", "text": "..."}
      ]
    }
  ],
  "closing": [
    {"speaker": "alex", "text": "..."},
    {"speaker": "marcus", "text": "..."}
  ]
}

Rules:
- Output MUST be parseable JSON.
- Do not add extra keys.
- Speakers must be exactly "alex" or "marcus".
- Keep each "text" SHORT — max ~150 characters per line.
- NEVER end a line with an em dash (—). Use ellipsis (...) or finish the sentence.

- NEVER output truncated lines (mid-word or mid-thought).


## FINAL CHECK — scan your output before returning
Before outputting, re-read your ENTIRE response and verify:
- "Exactly." never appears as a standalone response (0 allowed)
- "here's the thing" appears max 1 time across ALL segments
- "look," appears max 2 times across ALL segments
- "wait, seriously" appears max 1 time across ALL segments
- "honestly" appears max 1 time across ALL segments
- If an article has "cross_promo_hint", at least one host mentions it in that segment
- If schedule.episode_number % 3 == 0, the closing mentions the site
If any violation found, rephrase the offending line(s) before outputting.
"""


ASSEMBLY_PROMPT = """You are writing the connective tissue for a security podcast episode.
The story dialogues are already written. You ONLY need to write:

1. "intro": 2-3 lines of opening banter between Alex and Marcus
2. "transitions": one short transition line from Alex before each story
3. "closing": 2-3 lines wrapping up the episode

Hosts:
- Alex (female): anchor, sharp, keeps the show moving
- Marcus (male): analyst, dry humor

CRITICAL — VARIETY RULES:
- NEVER mention coffee, Monday morning, or "packed show" — these are overused clichés
- NEVER start with "Morning, Marcus" — vary the opening every time
- Reference something specific: the weather, a breaking story, a listener question, a joke about yesterday's news
- The intro should feel like you tuned into the middle of a real conversation
- Each episode must sound different from the last
- Transitions should reference the previous story or use natural pivots, not just "Next up" or "Moving on"

DAY NAME ANTI-REPETITION:
- Mention a specific day name (Monday/Tuesday/etc.) at most ONCE across intro + transitions + closing.
- After the first mention, use only: "today", "this morning", "later today", "right now", "tomorrow", "early next week".

	CONTINUITY WITH PREVIOUS EPISODES:
	- If "previously_covered" is provided, and today's stories overlap with recent episodes, reference it naturally.
	- Prefer phrasing like "more on the X situation from yesterday" or "quick update on the Y story from this morning".
	- If there is no overlap, ignore this entirely.

Keep lines SHORT (max 100 chars). Natural, conversational.

CROSS-PROMOTION (important — we need to grow the site):
- In the closing section, naturally mention the site about every 2-3 episodes.
- If schedule.episode_number is provided, ONLY do this when (schedule.episode_number % 3 == 0).
- Keep it to one brief line, not a sales pitch.

TTS SAFETY RULES (very important):
- NEVER end a line with an em dash (—). If a thought trails off, either complete it naturally or use ellipsis (...).
- Example BAD: "The breach affected about seventy-five million—"
- Example GOOD: "The breach affected about seventy-five million people..." or just finish the sentence.
- NEVER output truncated lines (mid-word or mid-thought). Every line must be a complete, speakable thought.

Return ONLY valid JSON:
{
  "intro": [
    {"speaker": "alex", "text": "..."},
    {"speaker": "marcus", "text": "..."}
  ],
  "transitions": ["Moving on,", "Next up,", ...],
  "closing": [
    {"speaker": "alex", "text": "..."},
    {"speaker": "marcus", "text": "..."}
  ]
}

"""


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
        if isinstance(r, dict):
            out.append(r)
    return out


def slim_article(a: dict[str, Any]) -> dict[str, Any]:
    """Reduce article fields to keep prompts smaller and stable."""
    out: dict[str, Any] = {
        "id": a.get("id"),
        "title": a.get("title"),
        "summary": a.get("summary"),
        "url": a.get("url"),
        "categories": a.get("categories") or [],
        "iocs": a.get("iocs") or [],
    }
    # Awareness + IOC metadata for cross-promotion plugs
    if a.get("has_awareness_lesson"):
        out["has_awareness_lesson"] = True
        if a.get("awareness_title"):
            out["awareness_title"] = a["awareness_title"]
    ioc_count = a.get("ioc_count") or 0
    if ioc_count > 0:
        out["ioc_count"] = ioc_count
        if a.get("ioc_types"):
            out["ioc_types"] = a["ioc_types"]
    return out


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


def _require_str(v: Any, name: str) -> str:
    if not isinstance(v, str) or not v.strip():
        raise ValueError(f"Missing or invalid '{name}'")
    return v.strip()


def _coerce_lines(lines_raw: Any, *, name: str) -> list[dict[str, str]]:
    if not isinstance(lines_raw, list) or not lines_raw:
        raise ValueError(f"Missing or invalid '{name}' (must be non-empty list)")

    out: list[dict[str, str]] = []
    for i, row in enumerate(lines_raw):
        if not isinstance(row, dict):
            continue
        speaker = str(row.get("speaker") or "").strip().lower()
        if speaker not in {"alex", "marcus"}:
            raise ValueError(f"Invalid {name}[{i}].speaker: must be 'alex' or 'marcus'")
        text = _require_str(row.get("text"), f"{name}[{i}].text")
        out.append({"speaker": speaker, "text": text})

    if not out:
        raise ValueError(f"'{name}' must contain at least one line")
    return out


_PHRASE_REPLACEMENTS: dict[str, list[str]] = {
    "exactly": ["that's it", "spot on", "bingo", "right there", "nailed it"],
    "here's the thing": [
        "the issue is",
        "what matters is",
        "the key part",
        "here's what bugs me",
        "the real problem",
    ],
    "wait, seriously": ["hold on", "wait what", "are you kidding", "no way", "come on"],
    "wait seriously": ["hold on", "wait what", "are you kidding", "no way", "come on"],
    "that's wild": ["that's intense", "that's nuts", "wow", "that's something", "whoa"],
    "look,": [
        "listen,",
        "okay so",
        "here's my take,",
        "think about it,",
        "consider this,",
    ],
    "honestly": ["truthfully", "real talk", "I gotta say", "frankly", "genuinely"],
}


def _fix_version_numbers(dialogue: dict[str, Any]) -> dict[str, Any]:
    """Replace complex version numbers with natural spoken alternatives.

    Versions with 3+ numeric segments (e.g. "14.0.3", "115.34.2") are hard
    to speak naturally. Replace them with "check the show notes for the exact version".
    Keep simple versions like "149" or "8.8".
    """
    import copy
    import re

    result: dict[str, Any] = copy.deepcopy(dialogue)

    # Match version patterns with 3+ numeric segments: X.Y.Z, X.Y.Z.W, etc.
    # Also match ranges like "<115.34" or ">=2026.1.3"
    complex_ver_re = re.compile(
        r"(?:version\s+|v\.?\s*)?"  # optional "version" prefix
        r"(?:[<>=!]+\s*)?"  # optional comparator
        r"\d+\.\d+\.\d+(?:\.\d+)*"  # 3+ segment version
    )

    # Match version lists like "2026.1, 14.0.3, and 13.2.3"
    ver_list_re = re.compile(
        r"\d+\.\d+(?:\.\d+)*(?:\s*,\s*\d+\.\d+(?:\.\d+)*){1,}(?:\s*,?\s*and\s+\d+\.\d+(?:\.\d+)*)?"
    )

    def _simplify_line(text: str) -> str:
        # Replace version lists first (broader match)
        text = ver_list_re.sub("the latest versions—check show notes", text)
        # Replace remaining complex versions
        text = complex_ver_re.sub("the latest patched version", text)
        # Clean up double replacements
        text = text.replace(
            "the latest patched version, the latest patched version",
            "the latest patched version",
        )
        text = text.replace(
            "the latest versions—check show notes, the latest versions—check show notes",
            "the latest versions—check show notes",
        )
        return text

    all_lines: list[dict[str, Any]] = []
    for line in result.get("intro", []) or []:
        if isinstance(line, dict):
            all_lines.append(line)
    for seg in result.get("segments", []) or []:
        if not isinstance(seg, dict):
            continue
        for line in seg.get("dialogue", []) or []:
            if isinstance(line, dict):
                all_lines.append(line)
    for line in result.get("closing", []) or []:
        if isinstance(line, dict):
            all_lines.append(line)

    for line in all_lines:
        text = str(line.get("text") or "")
        fixed = _simplify_line(text)
        if fixed != text:
            line["text"] = fixed

    return result


def _fix_repeated_phrases(dialogue: dict[str, Any]) -> dict[str, Any]:
    """Replace 2nd+ occurrences of overused phrases with deterministic alternatives."""

    import copy

    result: dict[str, Any] = copy.deepcopy(dialogue)

    # Collect all line dicts (intro, segments, closing) for in-place mutation.
    all_lines: list[dict[str, Any]] = []
    for line in result.get("intro", []) or []:
        if isinstance(line, dict):
            all_lines.append(line)
    for seg in result.get("segments", []) or []:
        if not isinstance(seg, dict):
            continue
        for line in seg.get("dialogue", []) or []:
            if isinstance(line, dict):
                all_lines.append(line)
    for line in result.get("closing", []) or []:
        if isinstance(line, dict):
            all_lines.append(line)

    for phrase, alternatives in _PHRASE_REPLACEMENTS.items():
        seen_count = 0
        for line_idx, line in enumerate(all_lines):
            text = str(line.get("text") or "")
            lower = text.lower()
            if phrase not in lower:
                continue

            seen_count += 1
            if seen_count <= 1:
                continue

            idx = lower.index(phrase)
            alt = alternatives[(seen_count + line_idx) % len(alternatives)]

            # Case-match: if original phrase starts with a capital, capitalize replacement.
            if idx < len(text) and text[idx : idx + 1].isupper():
                alt = alt[:1].upper() + alt[1:]

            line["text"] = text[:idx] + alt + text[idx + len(phrase) :]

    return result


def _build_schedule_context(
    date_str: str, edition: str, episode_count: int = 0
) -> dict[str, Any]:
    """Build schedule context so hosts reference correct days/dates."""

    dt = _stockholm_anchor_dt(date_str)
    day_name = dt.strftime("%A")
    pretty = f"{dt.strftime('%A')}, {dt.strftime('%B')} {dt.day}"

    if edition == "morning":
        this_ep = f"{pretty} morning"
        prev_dt = dt - timedelta(days=(3 if dt.weekday() == 0 else 1))
        # Mon→Fri, else prev day
        prev_ep = f"{prev_dt.strftime('%A')} afternoon"
        next_ep = "this afternoon"
    else:
        this_ep = f"{pretty} afternoon"
        prev_ep = "this morning"
        if dt.weekday() == 4:  # Friday
            next_dt = dt + timedelta(days=3)
            next_ep = "Monday morning"
        else:
            next_dt = dt + timedelta(days=1)
            next_ep = f"{next_dt.strftime('%A')} morning"

    return {
        "episode_number": max(0, int(episode_count)) + 1,
        "this_episode": this_ep,
        "previous_episode": prev_ep,
        "next_episode": next_ep,
        "day_of_week": day_name,
    }


def _easter_sunday(year: int) -> date_type:
    """Compute Easter Sunday (Gregorian calendar) for the given year."""

    # Anonymous Gregorian algorithm (Meeus/Jones/Butcher).
    a = year % 19
    b = year // 100
    c = year % 100
    d = b // 4
    e = b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i = c // 4
    k = c % 4
    l_val = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l_val) // 451
    month = (h + l_val - 7 * m + 114) // 31
    day = ((h + l_val - 7 * m + 114) % 31) + 1
    return date_type(year, month, day)


def _us_thanksgiving(year: int) -> date_type:
    """US Thanksgiving = 4th Thursday of November."""

    d = date_type(year, 11, 1)
    while d.weekday() != 3:  # Thursday
        d += timedelta(days=1)
    return d + timedelta(days=21)


def _midsummer_friday(year: int) -> date_type:
    """Swedish Midsummer = Friday closest to June 24."""

    target = date_type(year, 6, 24)
    candidates: list[date_type] = []
    for day in range(19, 26):
        d = date_type(year, 6, day)
        if d.weekday() == 4:  # Friday
            candidates.append(d)
    if not candidates:
        return target
    return min(candidates, key=lambda x: abs((x - target).days))


def _pretty_month_day(date_str: str) -> str:
    d = _stockholm_anchor_dt(date_str)
    # Avoid %-d portability issues.
    return f"{d.strftime('%B')} {d.day}"


def _supabase_get(url: str, headers: dict[str, str]) -> list[dict[str, Any]]:
    req = urllib_request.Request(url, headers={**headers, "Accept": "application/json"})
    with urllib_request.urlopen(req, timeout=10) as resp:
        payload = resp.read().decode("utf-8")
    data = json.loads(payload or "[]")
    if isinstance(data, list):
        return [row for row in data if isinstance(row, dict)]
    raise ValueError("Supabase REST response was not a JSON array")


def _fetch_calendar_events(today: date_type) -> list[tuple[int, str]]:
    """Query the events table for events active today or starting in the next 3 days.

    Returns list of (priority, framing_string) tuples matching the existing events list shape.
    Non-blocking: any error returns an empty list and logs a warning.
    """

    base_url = os.environ.get("SUPABASE_URL", DEFAULT_SUPABASE_URL).rstrip("/")
    service_key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not service_key:
        eprint("[podcast] events fetch: SUPABASE_SERVICE_KEY not set, skipping")
        return []

    out: list[tuple[int, str]] = []
    today_str = today.isoformat()
    soon_str = (today + timedelta(days=3)).isoformat()

    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
    }

    try:
        # Currently happening
        url_now = (
            f"{base_url}/rest/v1/events"
            f"?select=title,category,start_date,end_date"
            f"&status=eq.approved"
            f"&start_date=lte.{today_str}"
            f"&or=(end_date.gte.{today_str},end_date.is.null)"
            f"&order=start_date.desc"
            f"&limit=10"
        )
        rows = _supabase_get(url_now, headers)
        for ev in rows:
            title = (ev.get("title") or "").strip()
            if not title:
                continue
            # Null end_date events default to single-day; only emit if start_date == today.
            if ev.get("end_date") is None and ev.get("start_date") != today_str:
                continue
            category = (ev.get("category") or "").strip().lower()
            framing = _frame_event(title, category, "happening")
            out.append((2, framing))

        # Upcoming in next 3 days
        url_soon = (
            f"{base_url}/rest/v1/events"
            f"?select=title,category,start_date"
            f"&status=eq.approved"
            f"&start_date=gt.{today_str}"
            f"&start_date=lte.{soon_str}"
            f"&order=start_date.asc"
            f"&limit=5"
        )
        rows = _supabase_get(url_soon, headers)
        for ev in rows:
            title = (ev.get("title") or "").strip()
            if not title:
                continue
            sd = ev.get("start_date") or ""
            framing = f"{title} kicks off {sd} — pre-event chatter likely"
            out.append((2, framing))
    except Exception as exc:
        eprint(f"[podcast] events fetch failed: {exc}")
        return []

    return out[:5]  # cap to keep prompt focused; LLM picks 1-2 anyway


def _frame_event(title: str, category: str, status: str) -> str:
    """Generate a natural framing string for an event based on its category."""

    if status == "happening":
        if category == "conference":
            return (
                f"{title} is on this week — vendor announcements and talk tracks dominating the feed"
            )
        if category == "ctf":
            return f"{title} is running — CTF chatter, possible writeups dropping"
        if category in ("webinar", "workshop"):
            return f"{title} is happening today"
        if category == "meetup":
            return f"{title} happening today"
        return f"{title} ongoing"
    return title


def get_events_for_date(date_str: str) -> list[str]:
    """Return security/IT events for a given date, priority ordered."""

    dt = _stockholm_anchor_dt(date_str)
    d = dt.date()
    cal_path = Path(__file__).parent / "security_calendar.json"
    cal: dict[str, Any] = {}
    if cal_path.exists():
        with open(cal_path, "r", encoding="utf-8") as f:
            cal = json.load(f)

    events: list[tuple[int, str]] = []  # (priority, name)
    category_priority = {
        "security": 0,
        "awareness": 1,
        "privacy": 1,
        "holiday": 1,
        "conference": 2,
        "fun": 3,
    }

    # Built-in computed events (do not rely solely on the JSON calendar).
    holiday_hint = (
        "holiday week — reduced staffing, skeleton crews; mention this affects IR capacity "
        "and patch deployment timelines"
    )

    # Patch Tuesday: 2nd Tuesday (day 8–14)
    if dt.weekday() == 1 and 8 <= d.day <= 14:
        events.append(
            (
                0,
                "Patch Tuesday (big patch drops; prioritize patching + watch exploit chatter)",
            )
        )

    # Easter window (Good Friday through Easter Monday)
    easter = _easter_sunday(d.year)
    if easter - timedelta(days=2) <= d <= easter + timedelta(days=1):
        if d == easter - timedelta(days=2):
            events.append((1, f"Good Friday ({holiday_hint})"))
        elif d == easter - timedelta(days=1):
            events.append((1, f"Easter weekend ({holiday_hint})"))
        elif d == easter:
            events.append((1, f"Easter Sunday ({holiday_hint})"))
        else:
            events.append((1, f"Easter Monday ({holiday_hint})"))

    # Christmas week (Dec 24–26)
    if d.month == 12 and d.day in (24, 25, 26):
        events.append((1, f"Christmas week ({holiday_hint})"))

    # New Year's (Dec 31 – Jan 1)
    if (d.month == 12 and d.day == 31) or (d.month == 1 and d.day == 1):
        events.append((1, f"New Year's ({holiday_hint})"))

    # US Thanksgiving (4th Thursday of Nov) + surrounding week context
    thanksgiving = _us_thanksgiving(d.year)
    if d == thanksgiving:
        events.append((1, f"US Thanksgiving ({holiday_hint})"))
    elif thanksgiving - timedelta(days=3) <= d <= thanksgiving + timedelta(days=1):
        events.append((1, f"Thanksgiving week ({holiday_hint})"))

    # Midsummer (Friday closest to June 24)
    if d == _midsummer_friday(d.year):
        events.append((1, f"Midsummer (Sweden) ({holiday_hint})"))

    # Dynamic events from the Supabase events table (replaces the old hardcoded
    # RSA / Black Hat / Fal.Con windows; LEN-1597 + LEN-1605).
    events.extend(_fetch_calendar_events(d))

    # Computed rules
    for entry in cal.get("computed", []):
        if not isinstance(entry, dict):
            continue
        rule = str(entry.get("rule", "") or "")
        name = str(entry.get("name", "") or "").strip()
        if not name:
            continue

        if rule == "second_tuesday" and dt.weekday() == 1:
            # 2nd Tuesday: day 8-14
            if 8 <= d.day <= 14:
                prio = category_priority.get(str(entry.get("category", "") or ""), 9)
                events.append((prio, name))
        elif rule == "day_after_patch_tuesday" and dt.weekday() == 2:
            # Wednesday after 2nd Tuesday: day 9-15
            if 9 <= d.day <= 15:
                prio = category_priority.get(str(entry.get("category", "") or ""), 9)
                events.append((prio, name))

    # Fixed dates
    for entry in cal.get("fixed", []):
        if not isinstance(entry, dict):
            continue
        if d.month == entry.get("month") and d.day == entry.get("day"):
            name = str(entry.get("name", "") or "").strip()
            if not name:
                continue
            prio = category_priority.get(str(entry.get("category", "") or ""), 9)
            events.append((prio, name))

    # Ranges
    for entry in cal.get("ranges", []):
        if not isinstance(entry, dict):
            continue
        name = str(entry.get("name", "") or "").strip()
        if not name:
            continue
        try:
            start = date_type.fromisoformat(str(entry["start"]))
            end = date_type.fromisoformat(str(entry["end"]))
        except Exception:
            continue
        if end < start:
            continue

        if start <= d <= end:
            prio = category_priority.get(str(entry.get("category", "") or ""), 9)

            # Enrich multi-day ranges with temporal context so the model doesn't guess.
            total_days = (end - start).days + 1
            if total_days <= 1:
                events.append((prio, name))
                continue

            day_num = (d - start).days + 1
            # Avoid %-d portability issues.
            start_day = f"{start.strftime('%A')} {start.strftime('%B')} {start.day}"

            if day_num == 1:
                context = "kicks off today"
            elif day_num == 2:
                context = f"started yesterday {start_day}"
            else:
                context = f"started {start_day}"

            events.append((prio, f"{name} (Day {day_num} of {total_days}, {context})"))

    events.sort(key=lambda x: x[0])
    # De-dupe while preserving priority order.
    seen: set[str] = set()
    out: list[str] = []
    for _, name in events:
        key = str(name).strip().lower()
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(name)
    return out


def coerce_dialogue_schema(
    *, raw: dict[str, Any], date_str: str, edition: str = "morning"
) -> dict[str, Any]:
    d = _stockholm_anchor_dt(date_str)
    is_weekend = d.weekday() >= 5  # Saturday=5, Sunday=6
    if is_weekend:
        edition_label = "Weekend Brief"
    else:
        edition_label = {
            "morning": "Morning Brief",
            "afternoon": "Afternoon Brief",
        }.get(edition, "Brief")
    intro = _coerce_lines(raw.get("intro"), name="intro")
    closing = _coerce_lines(raw.get("closing"), name="closing")

    segs_raw = raw.get("segments")
    if not isinstance(segs_raw, list) or not segs_raw:
        raise ValueError("Output must include non-empty 'segments' list")

    segments: list[dict[str, Any]] = []
    for idx, s in enumerate(segs_raw):
        if not isinstance(s, dict):
            continue
        dialogue = _coerce_lines(s.get("dialogue"), name=f"segments[{idx}].dialogue")
        segments.append(
            {
                "source_article_id": _require_str(
                    s.get("source_article_id"), f"segments[{idx}].source_article_id"
                ),
                "headline": _require_str(
                    s.get("headline"), f"segments[{idx}].headline"
                ),
                "dialogue": dialogue,
            }
        )

    if not segments:
        raise ValueError("Output must include at least one segment")

    return {
        "date": date_str,
        "title": f"{edition_label} — {_pretty_month_day(date_str)}",
        "hosts": {
            "alex": {"voice": "nova", "role": "lead anchor"},
            "marcus": {"voice": "echo", "role": "analyst"},
        },
        "intro": intro,
        "segments": segments,
        "closing": closing,
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


def _coerce_transition_lines(v: Any) -> list[str]:
    if not isinstance(v, list):
        return []
    out: list[str] = []
    for item in v:
        if not isinstance(item, str):
            continue
        t = item.strip()
        if not t:
            continue
        out.append(t[:100])
    return out


def _coerce_story_dialogue(v: Any) -> list[dict[str, str]]:
    if not isinstance(v, list):
        return []
    out: list[dict[str, str]] = []
    for row in v:
        if not isinstance(row, dict):
            continue
        speaker = str(row.get("speaker") or "").strip().lower()
        if speaker not in {"alex", "marcus"}:
            continue
        text = str(row.get("text") or "").strip()
        if not text:
            continue
        out.append({"speaker": speaker, "text": text})
        if len(out) >= 8:
            break
    return out


def assemble_dialogue(
    articles: list[dict[str, Any]],
    date_str: str,
    edition: str = "morning",
    previously_covered: list[str] | None = None,
) -> tuple[dict[str, Any], Usage]:
    """Assemble podcast from pre-generated dialogue segments.

    Each article should have 'podcast_dialogue' field populated.
    Makes one small Haiku call for intro/transitions/closing.
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

    headlines = [str(a.get("title") or "Untitled").strip() for a in articles]
    episode_count = _episode_count_for(date_str, edition)
    schedule = _build_schedule_context(date_str, edition, episode_count=episode_count)
    schedule_info = (
        f"\n\nSchedule context:\n"
        f"- Episode number: {schedule['episode_number']}\n"
        f"- This episode: {schedule['this_episode']}\n"
        f"- Previous episode: {schedule['previous_episode']}\n"
        f"- Next episode: {schedule['next_episode']}\n"
        f"- Day: {schedule['day_of_week']}\n"
        "Use these values to stay correct (NEVER guess), but avoid day-name repetition. "
        "Mention a specific day name at most ONCE total; after that use 'today', 'this morning', "
        "'later today', 'tomorrow', or 'early next week', and paraphrase schedule strings as needed.\n\n"
    )

    events = get_events_for_date(date_str)
    if events:
        schedule_info += f"- Today's events: {', '.join(events)}\n"
        schedule_info += "Naturally weave the most relevant event into the intro or closing. Don't force it. Use at most 1-2.\n"

    if previously_covered:
        schedule_info += (
            "\nPreviously covered topics (reference these naturally when relevant):\n"
            + "\n".join(f"- {line}" for line in previously_covered if str(line).strip())
            + "\n"
        )

    user_text = (
        ASSEMBLY_PROMPT
        + schedule_info
        + "Stories in this episode:\n"
        + "\n".join(f"{i + 1}. {h or 'Untitled'}" for i, h in enumerate(headlines))
    )

    client = anthropic.Anthropic(api_key=api_key)
    started = time.time()
    resp = client.messages.create(
        model=MODEL,
        temperature=0.6,
        max_tokens=800,
        messages=[{"role": "user", "content": user_text}],
    )
    duration_ms = int((time.time() - started) * 1000)
    log_ai_call(
        pipeline="podcast_dialogue_intro_transitions_closing",
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
    text = "\n".join(parts).strip()

    obj = extract_json_object(text)
    intro = _coerce_lines(obj.get("intro"), name="intro")
    closing = _coerce_lines(obj.get("closing"), name="closing")
    transitions = _coerce_transition_lines(obj.get("transitions"))

    segments: list[dict[str, Any]] = []
    for i, article in enumerate(articles):
        article_id = str(article.get("id") or "").strip()
        if not article_id:
            continue

        headline = str(article.get("title") or "").strip() or "Untitled"
        dialogue_lines = _coerce_story_dialogue(article.get("podcast_dialogue"))
        if len(dialogue_lines) < 2:
            continue

        # Prepend transition line from Alex (except first story).
        # Skip if the segment already starts with an Alex line (avoids double-intro).
        if i > 0 and i < len(transitions):
            first_speaker = (
                dialogue_lines[0].get("speaker", "") if dialogue_lines else ""
            )
            if first_speaker != "alex":
                dialogue_lines = [
                    {"speaker": "alex", "text": transitions[i]}
                ] + dialogue_lines

        segments.append(
            {
                "source_article_id": article_id,
                "headline": headline,
                "dialogue": dialogue_lines,
            }
        )

    if not segments:
        raise ValueError("No valid podcast_dialogue segments found to assemble")

    assembled = {
        "intro": intro,
        "segments": segments,
        "closing": closing,
    }
    assembled = coerce_dialogue_schema(
        raw=assembled, date_str=date_str, edition=edition
    )
    assembled = _fix_repeated_phrases(assembled)
    assembled = _fix_version_numbers(assembled)
    return assembled, read_usage(resp)


def generate_dialogue(
    articles: list[dict[str, Any]],
    date_str: str,
    edition: str = "morning",
    previously_covered: list[str] | None = None,
    previous_intros: list[str] | None = None,
) -> tuple[dict[str, Any], Usage]:
    """Generate podcast dialogue JSON. Returns (dialogue_dict, usage)."""

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is not set")

    try:
        import anthropic  # type: ignore
    except Exception as exc:
        raise RuntimeError(
            "Missing dependency 'anthropic'. Install from scripts/podcast/requirements.txt"
        ) from exc

    client = anthropic.Anthropic(api_key=api_key)

    prompt_articles = [slim_article(a) for a in articles]

    d_check = _stockholm_anchor_dt(date_str)
    if d_check.weekday() >= 5:
        edition_label = "Weekend"
    else:
        edition_label = {"morning": "Morning", "afternoon": "Afternoon"}.get(
            edition, "Morning"
        )
    episode_count = _episode_count_for(date_str, edition)
    schedule_context = _build_schedule_context(
        date_str, edition, episode_count=episode_count
    )

    user_payload = {
        "date": date_str,
        "edition": edition_label,
        "schedule": schedule_context,
        "instructions": {
            "output_schema": "Return a single JSON object matching the required schema.",
            "hosts": {"alex": "lead anchor", "marcus": "analyst"},
        },
        "articles": prompt_articles,
    }

    if previously_covered:
        user_payload["previously_covered"] = [
            str(line).strip() for line in previously_covered if str(line).strip()
        ]

    if previous_intros:
        user_payload["previous_intros"] = previous_intros

    events = get_events_for_date(date_str)
    if events:
        user_payload["todays_events"] = events

    user_text = (
        f"Generate today's {edition_label} podcast dialogue as JSON. "
        "Remember: output ONLY JSON, no markdown.\n\n"
        + json.dumps(user_payload, ensure_ascii=False)
    )

    started = time.time()
    resp = client.messages.create(
        model=MODEL,
        temperature=TEMPERATURE,
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_text}],
    )
    duration_ms = int((time.time() - started) * 1000)
    log_ai_call(
        pipeline="podcast_dialogue_full_episode",
        model=MODEL,
        response=resp,
        duration_ms=duration_ms,
        metadata={
            "date": date_str,
            "edition": edition,
            "articles_in": len(articles),
            "previously_covered_count": len(previously_covered or []),
            "previous_intros_count": len(previous_intros or []),
        },
    )

    parts: list[str] = []
    for block in getattr(resp, "content", []) or []:
        t = getattr(block, "text", None)
        if isinstance(t, str):
            parts.append(t)
    text = "\n".join(parts).strip()

    stop_reason = getattr(resp, "stop_reason", None)
    if stop_reason not in ("end_turn", None):
        eprint(
            f"[generate_dialogue] WARNING: stop_reason={stop_reason} (response may be truncated)"
        )
        eprint(f"[generate_dialogue] response tail: ...{text[-200:]}")

    obj = extract_json_object(text)
    obj = coerce_dialogue_schema(raw=obj, date_str=date_str, edition=edition)
    obj = _fix_repeated_phrases(obj)
    obj = _fix_version_numbers(obj)
    return obj, read_usage(resp)


def parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Generate morning podcast dialogue JSON via Claude"
    )
    p.add_argument(
        "--articles",
        required=True,
        help="Path to articles JSON file",
    )
    p.add_argument(
        "--date",
        required=True,
        help="Podcast date (YYYY-MM-DD)",
    )
    p.add_argument(
        "--output",
        help="Optional output path. If omitted, writes JSON to stdout.",
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
    date_str = validate_date(str(args.date))
    payload = _load_json_from_file(str(args.articles))
    articles = normalize_articles(payload)

    eprint(
        f"[generate_dialogue] date={date_str} articles_in={len(articles)} model={MODEL}"
    )
    dialogue, u = generate_dialogue(articles=articles, date_str=date_str)
    cost_usd = usage_to_cost_usd(u)
    eprint(
        f"[generate_dialogue] tokens input={u.input_tokens} output={u.output_tokens}"
    )
    eprint(
        f"[generate_dialogue] estimated cost=${cost_usd:.6f} (haiku in ${HAIKU_INPUT_USD_PER_MTOK}/MTok, out ${HAIKU_OUTPUT_USD_PER_MTOK}/MTok)"
    )

    if args.output:
        with open(str(args.output), "w", encoding="utf-8") as f:
            json.dump(dialogue, f, ensure_ascii=False, indent=2)
            f.write("\n")
        eprint(f"[generate_dialogue] wrote {args.output}")
    else:
        json.dump(dialogue, sys.stdout, ensure_ascii=False, indent=2)
        sys.stdout.write("\n")
    return 0


if __name__ == "__main__":  # pragma: no cover
    try:
        raise SystemExit(main(sys.argv[1:]))
    except BrokenPipeError:
        raise
    except Exception as exc:
        eprint(f"[generate_dialogue] ERROR: {exc}")
        raise SystemExit(1)
