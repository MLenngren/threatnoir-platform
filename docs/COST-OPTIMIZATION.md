## Cost optimization (AI)

This doc explains how to reduce AI spend in ThreatNoir by using **hybrid routing** in `ai-gateway`.

### Goal

Keep high-visibility / public-facing pipelines on a higher quality provider (typically Claude), while routing everything else to a cheaper provider (typically local Ollama).

### How routing works

- `AI_PROVIDER` sets the global default provider.
- `AI_PROVIDER_<PIPELINE_NAME_UPPERCASE>` overrides the provider for a single pipeline.

Examples:

- `AI_PROVIDER=ollama` routes everything to Ollama.
- `AI_PROVIDER_WEEKLY_ROUNDUP=claude` routes only the weekly roundup pipeline to Claude.

### Recommended hybrid setup (example)

In `deploy/.env`:

- `AI_PROVIDER=ollama`
- `AI_PROVIDER_WEEKLY_ROUNDUP=claude`

Cloud-only cheap option (no local Ollama; keep quality on public-facing output, save money on bulk enrichment):

- `AI_PROVIDER=claude`
- `AI_PROVIDER_ARTICLE_SUMMARIZE=openrouter`
- `AI_PROVIDER_IOCS_EXTRACT=openrouter`
- `OPENROUTER_MODEL=google/gemini-2.0-flash-001`

This is the simplest **hybrid** configuration: it preserves quality on long-form, public-facing output while moving most background enrichment workloads off paid APIs.

### Canonical pipeline names

These names must match the gateway's canonical pipeline identifiers:

- `article_summarize`
- `iocs_extract`
- `awareness_lesson`
- `relevance_check`
- `social_draft`
- `video_briefing`
- `weekly_roundup`
- `auto_focus`
- `linkedin_focus_draft`
- `linkedin_midweek`
- `related_articles`
- `resource_tagger`

### Override env var reference

Set any of the following (optional):

- `AI_PROVIDER_ARTICLE_SUMMARIZE=...`
- `AI_PROVIDER_IOCS_EXTRACT=...`
- `AI_PROVIDER_AWARENESS_LESSON=...`
- `AI_PROVIDER_RELEVANCE_CHECK=...`
- `AI_PROVIDER_SOCIAL_DRAFT=...`
- `AI_PROVIDER_VIDEO_BRIEFING=...`
- `AI_PROVIDER_WEEKLY_ROUNDUP=...`
- `AI_PROVIDER_AUTO_FOCUS=...`
- `AI_PROVIDER_LINKEDIN_FOCUS_DRAFT=...`
- `AI_PROVIDER_LINKEDIN_MIDWEEK=...`
- `AI_PROVIDER_RELATED_ARTICLES=...`
- `AI_PROVIDER_RESOURCE_TAGGER=...`

### Practical cost notes

A typical pattern is:

- Cheap / high-volume: `relevance_check`, `iocs_extract`, `auto_focus` → local (Ollama)
- Expensive / high-visibility: `weekly_roundup`, `social_draft`, LinkedIn drafts → Claude

Hybrid routing gives you a bounded way to pay for quality only where it matters.

### Verifying hybrid routing

On gateway startup (or first call per pipeline), the gateway logs provider resolution in a grep-friendly format:

- `[providers] pipeline=<name> → AI_PROVIDER=<provider>`
- `[providers] pipeline=<name> → AI_PROVIDER_<PIPELINE>=<provider>`

### Production benchmark — cloud-cheap summarize (2026-05-31)

ThreatNoir's own production instance benchmarked Claude Haiku 4.5 vs **Google Gemini 2.0 Flash** (via OpenRouter) on the `article_summarize` pipeline, using identical prompts on real articles.

| Metric | Claude Haiku 4.5 | Gemini 2.0 Flash |
|---|---|---|
| Valid JSON | 80% | 100% |
| Avg latency | ~7.3s | ~2.7s |
| Cost / call | ~$0.0063 | ~$0.0004 (~16x cheaper) |
| Monthly (~26k calls) | ~$256 | ~$15 |

Findings:

- **Gemini 2.0 Flash is the cost-optimal cloud model for the bulk pipelines** (`article_summarize`, `iocs_extract`). It is ~16x cheaper than Haiku, faster, and its JSON mode (`response_format: json_object`) returns 100% valid JSON.
- For the cheapest reliable cloud setup: `AI_PROVIDER=openrouter` with `OPENROUTER_MODEL=google/gemini-2.0-flash-001` (now the default), and keep low-volume / high-visibility pipelines (`weekly_roundup`, `social_draft`, LinkedIn drafts) on `claude`.
- Local Ollama (`qwen2.5-coder:7b`) is the $0 alternative for the bulk pipelines but depends on your own always-on GPU host. Cloud Gemini Flash trades ~$15/mo for not running hardware.

#### max_tokens and the summarize JSON

The `article_summarize` response is a single JSON object containing the summary, brief, IOCs, entities, relevance score, **and a multi-line podcast dialogue**. That last field makes the output long. With `max_tokens: 1000` the JSON truncates mid-array on ~20% of articles (invalid JSON → no summary). Gemini is more verbose than Haiku and needed more headroom: at 1500 it still truncated ~12%, at **2500 it dropped to 0%**.

The gateway uses `max_tokens: 2500` for `classifyAndSummarize` / `extractIocs` across all providers. A higher ceiling only bills for tokens actually emitted, so it is pure upside for reducing truncation.

> Tip: if you route summarize to a provider/model and see intermittent "no summary" or JSON parse errors, raise the summarize `max_tokens` first — truncation is the most common cause.
