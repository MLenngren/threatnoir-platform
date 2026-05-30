## Running ThreatNoir with Docker Compose (deploy/)

This repo includes a Docker Compose stack under `deploy/` intended for operators who want a **single command** local bring-up that covers Phase 1-3:

- Nuxt app (SSR + API)
- Self-hosted Supabase (Postgres + Auth + Storage)
- Internal AI gateway (`ai-gateway`) for Anthropic calls + cost logging
- Inbucket for local magic-link email testing
- One-shot bootstrap container that seeds an admin user + backfills recent articles on first run

If you are doing day-to-day UI development (hot reload, etc.), you may prefer the Supabase CLI flow in [`docs/local-dev.md`](local-dev.md).

### Prerequisites

- Docker + Docker Compose v2

### Quick start (fresh operator)

1. Copy env:

   ```bash
   cd deploy
   cp .env.example .env
   ```

2. Edit `deploy/.env` and set:

   - `AI_GATEWAY_INTERNAL_TOKEN` (required; gateway refuses to start if blank)
     - generate: `openssl rand -hex 32`
   - `ADMIN_EMAIL` + `ADMIN_PASSWORD` (bootstrap seeds your first admin)

   Do **not** commit `deploy/.env` (it is operator-specific and gitignored).

   Optional (enables AI during first bootstrap run; costs money):

   - `ANTHROPIC_API_KEY`
   - `BOOTSTRAP_RUN_AI=true`

3. Start the stack:

   ```bash
   docker compose up -d
   docker compose logs -f bootstrap
   ```

4. Open:

   - App: `http://localhost:7000`
   - Supabase Studio: `http://localhost:7101`
   - Inbucket: `http://localhost:7111`

### Services + ports (defaults)

| Service | URL | Notes |
| --- | --- | --- |
| App | `http://localhost:${APP_PORT:-7000}` | Nuxt SSR + API |
| Supabase API (Kong) | `http://localhost:${SUPABASE_KONG_PORT:-7100}` | Auth/REST/Storage gateway |
| Supabase Studio | `http://localhost:${SUPABASE_STUDIO_PORT:-7101}` | Admin UI |
| Inbucket | `http://localhost:${INBUCKET_PORT:-7111}` | Local email inbox |

The AI gateway is **internal-only** (no host port).

### Common operator commands

Inspect the DB (without exposing Postgres to your host):

```bash
cd deploy
docker compose exec -T supabase-db psql -U postgres -d postgres
```

Trigger a cron endpoint manually:

```bash
curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" http://localhost:${APP_PORT:-7000}/api/cron/ingest
```

### First-run bootstrap container

On the first `docker compose up`, the `bootstrap` service:

- creates an admin user via GoTrue admin API (`ADMIN_EMAIL`/`ADMIN_PASSWORD`)
- calls `/api/cron/ingest` to backfill recent articles (`BACKFILL_HOURS`)
- optionally runs `/api/cron/summarize` -> `/api/cron/generate-awareness` if `BOOTSTRAP_RUN_AI=true` and `ANTHROPIC_API_KEY` is set
- writes a marker row to `public.system_bootstrap_runs`

It becomes a no-op if it detects a prior `status='success'` run.

To force a totally fresh bootstrap run, the simplest approach is:

```bash
cd deploy
docker compose down -v
docker compose up -d
```

### Email: Inbucket vs Resend

- **Supabase Auth emails** (magic links, confirmations) are delivered via SMTP to **Inbucket** (`SMTP_HOST=inbucket`).
- **App emails** (weekly digest, contact form, etc.) use **Resend**. In a local compose stack you can leave `RESEND_API_KEY` empty; features that send mail will be disabled or log warnings.

### AI in compose (ai-gateway)

In Docker Compose, the app defaults to calling the internal gateway:

`app` -> `POST http://ai-gateway:8080/...` -> Anthropic -> logs to `ai_call_log`.

Controls:

- Kill-switch: `AI_ENABLED=false` (disables all AI calls)
- Bypass gateway (direct Anthropic): set `AI_GATEWAY_URL=` (empty) and set `ANTHROPIC_API_KEY` on the app

See [`docs/AI-GATEWAY.md`](AI-GATEWAY.md) for the endpoint list and `pipeline` labels.

### Dev profile: expose Postgres on localhost

By default, Postgres is not exposed on a host port. For DB tools on your host machine:

```bash
cd deploy
docker compose --profile dev up -d
```

Then connect to `localhost:${SUPABASE_DB_PORT:-7110}`.

### Stopping / wiping

- Stop containers (keep volumes): `docker compose down`
- Wipe Supabase volumes (destructive): `docker compose down -v`

This compose stack is isolated via `COMPOSE_PROJECT_NAME=threatnoir-platform` and does not affect unrelated Docker stacks (including trading containers).
