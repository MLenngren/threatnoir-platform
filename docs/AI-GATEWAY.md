## AI gateway (deploy/ai-gateway)

The Docker Compose stack includes an internal service called `ai-gateway`.

### What is Ollama?

Ollama is a local model runtime that lets you download and run open-weight LLMs (Llama, Qwen, etc.) on your own machine.
ThreatNoir can point `ai-gateway` at Ollama instead of Claude, so you can run the enrichment pipeline without sending prompts off-box.
In exchange, you should expect lower quality and less reliable structured output vs Claude.

Purpose:

- Centralize AI provider calls (Claude by default; Ollama supported; more providers planned)
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

AI provider switch:

- `AI_PROVIDER` (default `claude`)

Ollama provider (Phase 4a/b):

- `OLLAMA_BASE_URL` (default `http://host.docker.internal:11434` in compose)
- `OLLAMA_MODEL` (default `llama3.1:8b`)

Notes:

- Ollama requires the operator to run Ollama separately and pull a model themselves.
- The gateway calls Ollama's Generate API: `POST <OLLAMA_BASE_URL>/api/generate`.
- Open-weight models are noticeably worse than Claude at reliably emitting structured JSON and doing security-domain classification.
- Upcoming: Phase 4c OpenRouter provider + Phase 4d local CLI provider.

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

---

### Switching to Ollama

ThreatNoir's compose stack runs `ai-gateway` inside Docker. That means:

- Ollama can run on your **host** (recommended) or in its own **separate Docker container** (Linux + NVIDIA only).
- `OLLAMA_BASE_URL` must be reachable **from inside the `ai-gateway` container** (so `http://localhost:11434` will *not* work in compose).

#### Option A (recommended): run Ollama on the host (macOS / Windows / Linux)

1. Install Ollama from https://ollama.com
2. Ensure the server is running (it listens on `http://localhost:11434`):

   - macOS/Windows: the Ollama app typically runs it for you.
   - Linux: run `ollama serve`.

3. Pull a small model (example):

   - `ollama pull qwen2.5:7b`

4. Point ThreatNoir at Ollama:

   - Edit `deploy/.env`:
     - `AI_PROVIDER=ollama`
     - `OLLAMA_MODEL=qwen2.5:7b`
     - `OLLAMA_BASE_URL=http://host.docker.internal:11434`

   Notes for Linux operators:
   - `host.docker.internal` works on Docker Desktop; on native Linux you may need to set `OLLAMA_BASE_URL` to your host IP
     (common fallback: `http://172.17.0.1:11434`) depending on your Docker setup.

5. Restart just the gateway:

   - `cd deploy && docker compose up -d --force-recreate ai-gateway`
   - `docker compose logs ai-gateway --tail=20`
   - Expected: `[providers] using AI_PROVIDER=ollama`

#### Option B: Ollama in Docker (Linux + NVIDIA only)

This option is useful if you want Ollama isolated in a container and you have an NVIDIA GPU.

Important caveat:

- GPU passthrough is **not** supported in Docker Desktop the same way it is on native Linux.
  Treat this option as **Linux + NVIDIA only**.

1. Install NVIDIA drivers + `nvidia-container-toolkit` on the host.
2. Start Ollama:

   - `docker volume create ollama`
   - `docker run -d --name ollama --restart unless-stopped --gpus all -p 11434:11434 -v ollama:/root/.ollama ollama/ollama`

3. Pull a model inside the container:

   - `docker exec -it ollama ollama pull qwen2.5:7b`

4. Set ThreatNoir env and restart `ai-gateway` (same as Option A).

---

### Model recommendations (practical defaults)

| Goal | Model | Notes |
| --- | --- | --- |
| Quick local smoke test | `qwen2.5:7b` | Strong for its size; generally decent at JSON-ish outputs. |
| Default / balanced | `llama3.1:8b` | Default in `.env.example`; works, but structured output is less reliable. |
| Better quality (more VRAM) | `qwen2.5:14b` | Higher quality than 7B; needs more GPU/CPU RAM. |
| "Try to match Claude" (very expensive) | `llama3.1:70b` | Requires serious hardware; still may not match Claude on strict schema compliance. |

You can see what you have installed with `ollama list`.

---

### Quality reality check (please read)

Ollama mode is a great way to develop locally or run a privacy-first deployment, but it is not a drop-in replacement for Claude:

- Expect slower responses and occasional malformed JSON.
- Classification accuracy and security-domain nuance is noticeably worse.
- As a rule of thumb: **Llama 3.1 8B is ~50% of Claude Haiku for structured output reliability**.

If you care about consistent automation (auto-approve thresholds, stable categorization, low operator intervention), keep `AI_PROVIDER=claude`.

### Disabling the gateway

- Disable AI everywhere: set `AI_ENABLED=false` (app + gateway) and restart.
- Bypass gateway and call Anthropic directly:
  - set `AI_GATEWAY_URL=` (empty) on the app
  - ensure the app has `ANTHROPIC_API_KEY`
