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
