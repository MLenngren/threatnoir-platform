## AI gateway (deploy/ai-gateway)

The Docker Compose stack includes an internal service called `ai-gateway`.

Purpose:

- Centralize AI provider calls (Phase 2 scaffold for Phase 4 pluggable providers)
- Enforce quota limits (`AI_DAILY_LIMIT`, `AI_MONTHLY_BUDGET_CENTS`, `AI_ENABLED`)
- Log every AI call to Supabase for cost tracking

In compose, the flow is:

`app` -> `ai-gateway` -> Anthropic -> inserts into `ai_call_log` and updates daily aggregates in `api_usage`.

### Auth / security model

- `ai-gateway` is intended to be **internal-only** (no host port mapping in compose).
- All non-health endpoints require:
  - `x-gateway-token: <AI_GATEWAY_INTERNAL_TOKEN>`
- The gateway refuses to start if `AI_GATEWAY_INTERNAL_TOKEN` is blank.

### Environment variables

Common:

- `AI_GATEWAY_INTERNAL_TOKEN` (required)
- `AI_ENABLED` (set `false` to kill-switch all AI calls)
- `AI_DAILY_LIMIT`
- `AI_MONTHLY_BUDGET_CENTS`

Anthropic provider:

- `ANTHROPIC_API_KEY` (required for AI endpoints that call Claude)

Supabase logging:

- `SUPABASE_URL` (in compose this is `http://supabase-kong:8000`)
- `SUPABASE_SERVICE_KEY` (service role JWT)

### Endpoints (13)

All endpoints below are `POST` and require `x-gateway-token`, unless stated otherwise.

| Path | Writes `ai_call_log.pipeline` | What it wraps |
| --- | --- | --- |
| `/summarize-article` | `article_summarize` | Article classify + summary (compose replacement for direct Anthropic call) |
| `/extract-iocs` | `iocs_extract` | Extract IOCs/entities from article text |
| `/generate-awareness` | `awareness_lesson` | Generate an awareness lesson from title + summary |
| `/rank-articles` | `relevance_check` | Lightweight relevance gate (`YES`/`NO`) |
| `/draft-social-post` | `social_draft` | Draft social copy (X + LinkedIn) |
| `/summarize-show` | `video_briefing` | Summarize a show script for briefing output |
| `/draft-weekly-roundup` | `weekly_roundup` | Draft weekly roundup (long-form + socials) |
| `/auto-focus-topics` | `auto_focus` | Auto-generate focus topics from an article |
| `/draft-linkedin-focus` | `linkedin_focus_draft` | Draft LinkedIn copy for focus item |
| `/draft-linkedin-midweek` | `linkedin_midweek` | Draft LinkedIn midweek post |
| `/find-related-articles` | `related_articles` | Decide whether two articles are related |
| `/tag-resource` | `resource_tagger` | Image tagging/categorization for resources |
| `/extract-cves` | (none) | Regex-only CVE extraction (no AI, no cost log) |

Healthcheck:

- `GET /health` -> `{ "status": "ok" }`

### Disabling the gateway

- Disable AI everywhere: set `AI_ENABLED=false` (app + gateway) and restart.
- Bypass gateway and call Anthropic directly:
  - set `AI_GATEWAY_URL=` (empty) on the app
  - ensure the app has `ANTHROPIC_API_KEY`

### Phase 4 placeholder

Phase 4 will add additional providers (Ollama / OpenRouter / local CLI) behind this gateway, without changing the app's call sites.
