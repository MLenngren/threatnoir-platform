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
- For hybrid setups + cost-saving guidance, see `docs/COST-OPTIMIZATION.md`.

Ollama provider (Phase 4a/b):

- `OLLAMA_BASE_URL` (default `http://host.docker.internal:11434` in compose)
- `OLLAMA_MODEL` (default `qwen2.5-coder:7b`)

OpenRouter provider (Phase 4c):

- `OPENROUTER_API_KEY` (required when `AI_PROVIDER=openrouter`)
- `OPENROUTER_MODEL` (example: `anthropic/claude-3.5-haiku`)

CLI provider (Phase 4d):

- `AI_CLI_BIN` (default `claude`)
- `AI_CLI_ARGS` (default `--print`)
- `AI_CLI_TIMEOUT_MS` (default `60000`)

Notes:

- Ollama requires the operator to run Ollama separately and pull a model themselves.
- The gateway calls Ollama's Generate API: `POST <OLLAMA_BASE_URL>/api/generate`.
- Open-weight models are noticeably worse than Claude at reliably emitting structured JSON and doing security-domain classification.
- OpenRouter provides multi-model access + unified billing while keeping the same prompts/parsers.
- Phase 4d local CLI provider is supported (spawn a local agent binary).

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

#### Local model shootout (2026-05-30)

| Model | Wall | Processed | IoCs | Verdict |
| --- | --- | --- | --- | --- |
| **qwen2.5-coder:7b** | 46s | 3/3 | 2 (CVE + MITRE T1047) | 🥇 Factual, code-tuned JSON adherence, no hallucinations |
| qwen2.5:7b | 45s | 3/3 | 1 (hallucinated URL) | Fast, summaries solid, IoC weak |
| llama3.1:8b | 56s | 3/3 | 2 (CVE + plausible URL) | 25% slower, comparable quality, occasional URL hallucination |
| gemma2:9b | 192s | 1/3 | 0 | ❌ Broken at this prompt complexity on 8GB VRAM — 5x slower, silently drops 2/3 articles |

*Methodology: 3 fixed test articles (CVE+vendor, supply-chain campaign, credential theft), single `curl POST /api/cron/summarize` run per model, RTX 5060 8GB VRAM, `AI_PROVIDER=ollama`. Wall time includes all calls (article_summarize + awareness_lesson + auto_focus + linkedin_focus_draft pipelines).*

#### Option A (recommended): run Ollama on the host (macOS / Windows / Linux)

1. Install Ollama from https://ollama.com
2. Ensure the server is running (it listens on `http://localhost:11434`):

   - macOS/Windows: the Ollama app typically runs it for you.
   - Linux: run `ollama serve`.

3. Pull a small model (example):

   - `ollama pull qwen2.5-coder:7b`

4. Point ThreatNoir at Ollama:

   - Edit `deploy/.env`:
     - `AI_PROVIDER=ollama`
     - `OLLAMA_MODEL=qwen2.5-coder:7b`
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

   - `docker exec -it ollama ollama pull qwen2.5-coder:7b`

4. Set ThreatNoir env and restart `ai-gateway` (same as Option A).

---

### Switching to OpenRouter

OpenRouter is a hosted router that exposes an OpenAI-compatible Chat Completions API (`/v1/chat/completions`).

In practice, if you set `OPENROUTER_MODEL=anthropic/claude-3.5-haiku`, quality is **effectively identical** to calling Claude directly.
The win is multi-model access + unified billing behind a single API.

1. Create an API key at https://openrouter.ai
2. Edit `deploy/.env`:
   - `AI_PROVIDER=openrouter`
   - `OPENROUTER_API_KEY=...`
   - `OPENROUTER_MODEL=anthropic/claude-3.5-haiku`
3. Restart just the gateway:
   - `cd deploy && docker compose up -d --force-recreate ai-gateway`
   - `docker compose logs ai-gateway --tail=20`
   - Expected: `[providers] using AI_PROVIDER=openrouter`

---

### Switching to CLI provider (Phase 4d)

The CLI provider lets you run AI through a **local CLI agent** (for example `claude` / `claude-code`) instead of an HTTP API.

This is useful when operators already have a paid desktop/CLI subscription and want to avoid managing separate API keys.

Important caveats:

- CLI agents are typically **slower** than API calls.
- Structured output quality depends entirely on the CLI output mode. Prefer JSON output flags when available.
- The gateway sends prompts via **stdin** (never argv) to avoid shell injection and handle large prompts.

#### Option A — Bind-mount host claude (recommended)

    # Prerequisites:
    #   - claude CLI installed (https://docs.claude.com/en/docs/claude-code/setup)
    #   - Logged in once so ~/.claude.json exists

    cd deploy
    docker compose -f compose.yaml -f compose.cli.yaml up -d --build ai-gateway

    # Verify
    docker compose -f compose.yaml -f compose.cli.yaml exec ai-gateway claude --version
    docker compose -f compose.yaml -f compose.cli.yaml logs ai-gateway --tail=10
    # Expect: "[entrypoint] linked claude → /opt/claude/versions/X.Y.Z"
    #         "[providers] using AI_PROVIDER=cli"

##### How authentication works

The compose override bind-mounts your host's `~/.claude.json` (containing your Claude Code session token) into the gateway container read-only. There is **no separate auth step inside the container** — the containerized `claude` binary reads the same auth file your host CLI uses.

- **First-time setup:** the host login (Claude Pro/Max account or API key) must already exist. If you've never run `claude` interactively on this machine, the bind-mount will fail because `~/.claude.json` doesn't exist yet. Fix: run `claude` once on the host to sign in, then bring up the stack.
- **Token refresh:** if your Claude Code session expires while the stack is running, gateway calls start failing. Run `claude` once on the host to refresh — the read-only bind-mount reflects the new token live, no container restart needed.
- **Account attribution:** all AI calls bill your **personal** Claude Code account (the one in `~/.claude.json`), not the Anthropic API workspace owning `ANTHROPIC_API_KEY` in `.env`. Heavy ThreatNoir use will consume your personal Claude Code quota. If you want both providers to attribute to the same workspace, use `AI_PROVIDER=claude` with an API key from the same org instead.

#### Option B — Build a custom gateway image with claude-code installed

This option is for operators who want a self-contained gateway image without host bind-mounts.

- Example (Dockerfile change in your fork):
  - `RUN npm install -g @anthropic-ai/claude-code`

> ⚠️ **Cost trap:** Claude Code auto-loads your `~/.claude.json` project context (CLAUDE.md files, agent rules, prior session context) on EVERY call. Without `--model haiku` forced via `AI_CLI_ARGS`, a single article summarize call can cost **$0.20+** because Claude Code defaults to Opus + 30K cache tokens. The `compose.cli.yaml` override forces `--model haiku` — keep it that way unless you understand the cost trade-off. For comparison, direct API + Haiku is ~$0.001/call.

> ⚠️ ~15-20s per summarize call vs ~2s for direct API. Acceptable for cron-driven pipelines, not interactive use.

---

### Model recommendations (practical defaults)

| Goal | Model | Notes |
| --- | --- | --- |
| Recommended default (8GB+ VRAM) | `qwen2.5-coder:7b` | Best balance in our shootout for cyber-intel structured JSON: strong schema adherence + better IoC/framework extraction. |
| Quick local smoke test | `qwen2.5:7b` | Fast and generally solid summaries, but weaker IoC extraction at this prompt complexity. |
| Baseline alternative | `llama3.1:8b` | Comparable summaries but slower (~25%) and more prone to occasional URL hallucinations vs `qwen2.5-coder:7b`. |
| Better quality (more VRAM) | `qwen2.5:14b` | Higher quality than 7B; needs more GPU/CPU RAM. |
| "Try to match Claude" (very expensive) | `llama3.1:70b` | Requires serious hardware; still may not match Claude on strict schema compliance. |

You can see what you have installed with `ollama list`.

---

### Quality reality check (please read)

Ollama mode is a great way to develop locally or run a privacy-first deployment, but it is not a drop-in replacement for Claude:

- Expect slower responses and occasional malformed JSON.
- Classification accuracy and security-domain nuance is noticeably worse.
- As a rule of thumb: **qwen2.5-coder:7b reaches roughly ~75% of Claude Haiku quality on structured cyber-intel JSON output (in our 3-article shootout)** — meaningfully better than `llama3.1:8b` for IoC extraction and framework references. Quality scales with VRAM and model choice — the recommendation assumes 8GB+ VRAM with the listed quantizations.

If you care about consistent automation (auto-approve thresholds, stable categorization, low operator intervention), keep `AI_PROVIDER=claude`.

### Disabling the gateway

- Disable AI everywhere: set `AI_ENABLED=false` (app + gateway) and restart.
- Bypass gateway and call Anthropic directly:
  - set `AI_GATEWAY_URL=` (empty) on the app
  - ensure the app has `ANTHROPIC_API_KEY`
